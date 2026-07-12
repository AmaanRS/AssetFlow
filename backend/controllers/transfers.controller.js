import { prisma } from "../database/prisma.js";
import { logActivity } from "../services/activity-log.js";
import { createNotification } from "../services/notifications.js";
import { runSerializableTransaction } from "../utils/db.js";
import {
  findUnexpectedFields,
  isPositiveInteger,
  optionalTrimmedString,
  toPositiveInteger,
} from "../utils/validation.js";

const transferSelect = {
  transferRequestId: true,
  assetId: true,
  fromUserId: true,
  fromDepartmentId: true,
  toUserId: true,
  toDepartmentId: true,
  requestedById: true,
  approvedById: true,
  reason: true,
  status: true,
  requestedAt: true,
  approvedAt: true,
  asset: { select: { assetId: true, assetTag: true, name: true, status: true } },
  fromUser: { select: { userId: true, name: true } },
  fromDepartment: { select: { departmentId: true, name: true } },
  toUser: { select: { userId: true, name: true } },
  toDepartment: { select: { departmentId: true, name: true } },
  requestedBy: { select: { userId: true, name: true } },
  approvedBy: { select: { userId: true, name: true } },
};

class AssetNotFoundError extends Error {}
class AssetNotAllocatedError extends Error {}
class RecipientNotFoundError extends Error {}
class SameHolderError extends Error {}
class OpenTransferExistsError extends Error {}
class TransferNotFoundError extends Error {}
class TransferNotPendingError extends Error {}
class AssetHolderChangedError extends Error {}

function validateTarget(body, errors) {
  const hasUser = body?.toUserId != null;
  const hasDepartment = body?.toDepartmentId != null;

  if (hasUser === hasDepartment) {
    errors.recipient = "Provide exactly one of toUserId or toDepartmentId.";
    return { toUserId: null, toDepartmentId: null };
  }

  const toUserId = hasUser ? toPositiveInteger(body.toUserId) : null;
  const toDepartmentId = hasDepartment ? toPositiveInteger(body.toDepartmentId) : null;

  if (hasUser && !toUserId) {
    errors.toUserId = "toUserId must be a positive integer.";
  }
  if (hasDepartment && !toDepartmentId) {
    errors.toDepartmentId = "toDepartmentId must be a positive integer.";
  }

  return { toUserId, toDepartmentId };
}

async function createTransferRequest(request, response, next) {
  const errors = {};
  const unexpectedFields = findUnexpectedFields(request.body, [
    "assetId",
    "toUserId",
    "toDepartmentId",
    "reason",
  ]);

  if (!isPositiveInteger(request.body?.assetId)) {
    errors.assetId = "Asset ID must be a positive integer.";
  }

  const { toUserId, toDepartmentId } = validateTarget(request.body, errors);

  if (unexpectedFields.length > 0) {
    errors.request = `Unexpected fields: ${unexpectedFields.join(", ")}.`;
  }

  if (Object.keys(errors).length > 0) {
    return response.status(400).json({ message: "Invalid request data.", errors });
  }

  const reason = optionalTrimmedString(request.body?.reason);

  try {
    const result = await runSerializableTransaction(async (transaction) => {
      const asset = await transaction.asset.findUnique({
        where: { assetId: request.body.assetId },
        select: {
          assetId: true,
          assetTag: true,
          name: true,
          status: true,
          currentHolderUserId: true,
          currentHolderDepartmentId: true,
        },
      });

      if (!asset) {
        throw new AssetNotFoundError();
      }
      if (asset.status !== "Allocated") {
        throw new AssetNotAllocatedError();
      }
      if (
        (toUserId && toUserId === asset.currentHolderUserId) ||
        (toDepartmentId && toDepartmentId === asset.currentHolderDepartmentId)
      ) {
        throw new SameHolderError();
      }

      if (toUserId) {
        const user = await transaction.user.findUnique({
          where: { userId: toUserId },
          select: { userId: true },
        });
        if (!user) throw new RecipientNotFoundError();
      } else {
        const department = await transaction.department.findUnique({
          where: { departmentId: toDepartmentId },
          select: { departmentId: true },
        });
        if (!department) throw new RecipientNotFoundError();
      }

      const openTransfer = await transaction.transferRequest.findFirst({
        where: { assetId: asset.assetId, status: "Requested" },
        select: { transferRequestId: true },
      });
      if (openTransfer) {
        throw new OpenTransferExistsError();
      }

      const transfer = await transaction.transferRequest.create({
        data: {
          assetId: asset.assetId,
          fromUserId: asset.currentHolderUserId,
          fromDepartmentId: asset.currentHolderDepartmentId,
          toUserId,
          toDepartmentId,
          requestedById: request.user.userId,
          reason,
          status: "Requested",
        },
        select: transferSelect,
      });

      await logActivity(
        {
          actorUserId: request.user.userId,
          actionType: "TransferRequested",
          entityType: "Asset",
          entityId: asset.assetId,
          details: `Requested transfer of ${asset.assetTag}.`,
        },
        transaction,
      );

      // Notify the current holder that a transfer was requested.
      if (asset.currentHolderUserId && asset.currentHolderUserId !== request.user.userId) {
        await createNotification(
          {
            userId: asset.currentHolderUserId,
            type: "TransferRequested",
            message: `A transfer of ${asset.assetTag} (${asset.name}) you hold is awaiting approval.`,
            linkPath: "/allocations",
          },
          transaction,
        );
      }

      return transfer;
    });

    return response.status(201).json({ transfer: result });
  } catch (error) {
    if (error instanceof AssetNotFoundError || error?.code === "P2003") {
      return response.status(404).json({ message: "Asset not found." });
    }
    if (error instanceof AssetNotAllocatedError) {
      return response.status(409).json({
        message: "Only an allocated asset can be transferred. Allocate it instead.",
      });
    }
    if (error instanceof RecipientNotFoundError) {
      return response.status(404).json({ message: "The transfer recipient was not found." });
    }
    if (error instanceof SameHolderError) {
      return response
        .status(409)
        .json({ message: "The asset is already held by this recipient." });
    }
    if (error instanceof OpenTransferExistsError) {
      return response
        .status(409)
        .json({ message: "A transfer request for this asset is already pending." });
    }
    return next(error);
  }
}

async function approveTransferRequest(request, response, next) {
  const transferRequestId = toPositiveInteger(request.params.transferRequestId);

  if (!transferRequestId) {
    return response.status(400).json({
      message: "Invalid request data.",
      errors: { transferRequestId: "Transfer request ID must be a positive integer." },
    });
  }

  try {
    const result = await runSerializableTransaction(async (transaction) => {
      const transfer = await transaction.transferRequest.findUnique({
        where: { transferRequestId },
        select: {
          transferRequestId: true,
          assetId: true,
          fromUserId: true,
          fromDepartmentId: true,
          toUserId: true,
          toDepartmentId: true,
          requestedById: true,
          status: true,
          asset: { select: { assetTag: true, name: true, status: true, currentHolderUserId: true, currentHolderDepartmentId: true } },
        },
      });

      if (!transfer) {
        throw new TransferNotFoundError();
      }
      if (transfer.status !== "Requested") {
        throw new TransferNotPendingError();
      }
      if (
        transfer.asset.status !== "Allocated" ||
        transfer.asset.currentHolderUserId !== transfer.fromUserId ||
        transfer.asset.currentHolderDepartmentId !== transfer.fromDepartmentId
      ) {
        throw new AssetHolderChangedError();
      }

      // Close the current active allocation(s).
      await transaction.assetAllocation.updateMany({
        where: {
          assetId: transfer.assetId,
          status: { in: ["Active", "ReturnRequested"] },
        },
        data: { status: "Returned", returnedAt: new Date() },
      });

      // Create the new allocation for the target holder.
      await transaction.assetAllocation.create({
        data: {
          assetId: transfer.assetId,
          allocatedToUserId: transfer.toUserId,
          allocatedToDepartmentId: transfer.toDepartmentId,
          allocatedById: request.user.userId,
          status: "Active",
        },
      });

      await transaction.asset.update({
        where: { assetId: transfer.assetId },
        data: {
          status: "Allocated",
          currentHolderUserId: transfer.toUserId,
          currentHolderDepartmentId: transfer.toDepartmentId,
        },
      });

      const updated = await transaction.transferRequest.update({
        where: { transferRequestId },
        data: {
          status: "Approved",
          approvedById: request.user.userId,
          approvedAt: new Date(),
        },
        select: transferSelect,
      });

      await logActivity(
        {
          actorUserId: request.user.userId,
          actionType: "TransferApproved",
          entityType: "Asset",
          entityId: transfer.assetId,
          details: `Approved transfer of ${transfer.asset.assetTag}.`,
        },
        transaction,
      );

      const recipients = [];
      if (transfer.toUserId) {
        recipients.push({
          userId: transfer.toUserId,
          type: "AssetAssigned",
          message: `${transfer.asset.assetTag} (${transfer.asset.name}) has been transferred to you.`,
          linkPath: "/allocations",
        });
      }
      if (transfer.requestedById && transfer.requestedById !== transfer.toUserId) {
        recipients.push({
          userId: transfer.requestedById,
          type: "TransferApproved",
          message: `Your transfer request for ${transfer.asset.assetTag} was approved.`,
          linkPath: "/allocations",
        });
      }
      for (const recipient of recipients) {
        await createNotification(recipient, transaction);
      }

      return updated;
    });

    return response.status(200).json({ transfer: result });
  } catch (error) {
    if (error instanceof TransferNotFoundError) {
      return response.status(404).json({ message: "Transfer request not found." });
    }
    if (error instanceof TransferNotPendingError) {
      return response
        .status(409)
        .json({ message: "This transfer request is not pending." });
    }
    if (error instanceof AssetHolderChangedError) {
      return response.status(409).json({
        message: "The asset holder changed since this request. The transfer can no longer be approved.",
      });
    }
    return next(error);
  }
}

async function rejectTransferRequest(request, response, next) {
  const transferRequestId = toPositiveInteger(request.params.transferRequestId);

  if (!transferRequestId) {
    return response.status(400).json({
      message: "Invalid request data.",
      errors: { transferRequestId: "Transfer request ID must be a positive integer." },
    });
  }

  try {
    const result = await prisma.$transaction(async (transaction) => {
      const transfer = await transaction.transferRequest.findUnique({
        where: { transferRequestId },
        select: {
          transferRequestId: true,
          assetId: true,
          requestedById: true,
          status: true,
          asset: { select: { assetTag: true } },
        },
      });

      if (!transfer) {
        throw new TransferNotFoundError();
      }
      if (transfer.status !== "Requested") {
        throw new TransferNotPendingError();
      }

      const updated = await transaction.transferRequest.update({
        where: { transferRequestId },
        data: {
          status: "Rejected",
          approvedById: request.user.userId,
          approvedAt: new Date(),
        },
        select: transferSelect,
      });

      await logActivity(
        {
          actorUserId: request.user.userId,
          actionType: "TransferRejected",
          entityType: "Asset",
          entityId: transfer.assetId,
          details: `Rejected transfer of ${transfer.asset.assetTag}.`,
        },
        transaction,
      );

      await createNotification(
        {
          userId: transfer.requestedById,
          type: "TransferRejected",
          message: `Your transfer request for ${transfer.asset.assetTag} was rejected.`,
          linkPath: "/allocations",
        },
        transaction,
      );

      return updated;
    });

    return response.status(200).json({ transfer: result });
  } catch (error) {
    if (error instanceof TransferNotFoundError) {
      return response.status(404).json({ message: "Transfer request not found." });
    }
    if (error instanceof TransferNotPendingError) {
      return response
        .status(409)
        .json({ message: "This transfer request is not pending." });
    }
    return next(error);
  }
}

function buildTransferScope(user, query) {
  const where = {};

  if (
    typeof query.status === "string" &&
    ["Requested", "Approved", "Rejected"].includes(query.status)
  ) {
    where.status = query.status;
  }

  if (user.role === "Employee") {
    where.OR = [
      { requestedById: user.userId },
      { toUserId: user.userId },
      { fromUserId: user.userId },
    ];
  } else if (user.role === "DepartmentHead") {
    const departmentId = user.departmentId ?? -1;
    where.OR = [
      { fromDepartmentId: departmentId },
      { toDepartmentId: departmentId },
      { requestedBy: { departmentId } },
      { fromUser: { departmentId } },
      { toUser: { departmentId } },
    ];
  }
  // AssetManager and Admin see everything.

  return where;
}

async function listTransferRequests(request, response, next) {
  const where = buildTransferScope(request.user, request.query);

  try {
    const transfers = await prisma.transferRequest.findMany({
      where,
      select: transferSelect,
      orderBy: { transferRequestId: "desc" },
    });

    return response.status(200).json({ transfers });
  } catch (error) {
    return next(error);
  }
}

export {
  approveTransferRequest,
  createTransferRequest,
  listTransferRequests,
  rejectTransferRequest,
};
