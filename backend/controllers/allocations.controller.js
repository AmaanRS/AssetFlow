import { prisma } from "../database/prisma.js";
import { logActivity } from "../services/activity-log.js";
import { createNotification } from "../services/notifications.js";
import { runSerializableTransaction } from "../utils/db.js";
import {
  findUnexpectedFields,
  isPositiveInteger,
  optionalTrimmedString,
  parseIsoDateTime,
  toPositiveInteger,
} from "../utils/validation.js";

const activeAllocationStatuses = ["Active", "ReturnRequested"];

const allocationSelect = {
  allocationId: true,
  assetId: true,
  allocatedToUserId: true,
  allocatedToDepartmentId: true,
  allocatedById: true,
  allocatedAt: true,
  expectedReturnDate: true,
  returnedAt: true,
  checkInNotes: true,
  returnCondition: true,
  status: true,
  asset: { select: { assetId: true, assetTag: true, name: true, status: true } },
  allocatedToUser: { select: { userId: true, name: true, email: true } },
  allocatedToDepartment: { select: { departmentId: true, name: true } },
  allocatedBy: { select: { userId: true, name: true } },
};

class AssetNotFoundError extends Error {}
class RecipientNotFoundError extends Error {}
class AssetNotAvailableError extends Error {
  constructor(holder) {
    super();
    this.holder = holder;
  }
}
class AllocationNotFoundError extends Error {}
class AllocationNotReturnableError extends Error {}

function validateRecipient(body, errors) {
  const hasUser = body?.allocatedToUserId != null;
  const hasDepartment = body?.allocatedToDepartmentId != null;

  if (hasUser === hasDepartment) {
    errors.recipient =
      "Provide exactly one of allocatedToUserId or allocatedToDepartmentId.";
    return { allocatedToUserId: null, allocatedToDepartmentId: null };
  }

  const allocatedToUserId = hasUser ? toPositiveInteger(body.allocatedToUserId) : null;
  const allocatedToDepartmentId = hasDepartment
    ? toPositiveInteger(body.allocatedToDepartmentId)
    : null;

  if (hasUser && !allocatedToUserId) {
    errors.allocatedToUserId = "allocatedToUserId must be a positive integer.";
  }
  if (hasDepartment && !allocatedToDepartmentId) {
    errors.allocatedToDepartmentId =
      "allocatedToDepartmentId must be a positive integer.";
  }

  return { allocatedToUserId, allocatedToDepartmentId };
}

async function createAllocation(request, response, next) {
  const errors = {};
  const unexpectedFields = findUnexpectedFields(request.body, [
    "assetId",
    "allocatedToUserId",
    "allocatedToDepartmentId",
    "expectedReturnDate",
  ]);

  if (!isPositiveInteger(request.body?.assetId)) {
    errors.assetId = "Asset ID must be a positive integer.";
  }

  const { allocatedToUserId, allocatedToDepartmentId } = validateRecipient(
    request.body,
    errors,
  );

  let expectedReturnDate = null;
  if (
    request.body?.expectedReturnDate !== undefined &&
    request.body?.expectedReturnDate !== null
  ) {
    expectedReturnDate = parseIsoDateTime(request.body.expectedReturnDate);
    if (!expectedReturnDate) {
      errors.expectedReturnDate =
        "expectedReturnDate must be a valid ISO-8601 date-time.";
    }
  }

  if (unexpectedFields.length > 0) {
    errors.request = `Unexpected fields: ${unexpectedFields.join(", ")}.`;
  }

  if (Object.keys(errors).length > 0) {
    return response.status(400).json({ message: "Invalid request data.", errors });
  }

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
          currentHolderUser: { select: { userId: true, name: true } },
          currentHolderDepartment: { select: { departmentId: true, name: true } },
        },
      });

      if (!asset) {
        throw new AssetNotFoundError();
      }

      if (asset.status !== "Available") {
        throw new AssetNotAvailableError({
          status: asset.status,
          holderUser: asset.currentHolderUser,
          holderDepartment: asset.currentHolderDepartment,
        });
      }

      if (allocatedToUserId) {
        const user = await transaction.user.findUnique({
          where: { userId: allocatedToUserId },
          select: { userId: true, name: true },
        });
        if (!user) {
          throw new RecipientNotFoundError();
        }
      } else {
        const department = await transaction.department.findUnique({
          where: { departmentId: allocatedToDepartmentId },
          select: { departmentId: true, headUserId: true },
        });
        if (!department) {
          throw new RecipientNotFoundError();
        }
      }

      const allocation = await transaction.assetAllocation.create({
        data: {
          assetId: asset.assetId,
          allocatedToUserId,
          allocatedToDepartmentId,
          allocatedById: request.user.userId,
          expectedReturnDate,
          status: "Active",
        },
        select: allocationSelect,
      });

      await transaction.asset.update({
        where: { assetId: asset.assetId },
        data: {
          status: "Allocated",
          currentHolderUserId: allocatedToUserId,
          currentHolderDepartmentId: allocatedToDepartmentId,
        },
      });

      await logActivity(
        {
          actorUserId: request.user.userId,
          actionType: "AssetAllocated",
          entityType: "Asset",
          entityId: asset.assetId,
          details: `Allocated ${asset.assetTag} to ${
            allocatedToUserId ? `user #${allocatedToUserId}` : `department #${allocatedToDepartmentId}`
          }.`,
        },
        transaction,
      );

      // Notify the recipient (or the department head for department allocations).
      let notifyUserId = allocatedToUserId;
      if (!notifyUserId && allocatedToDepartmentId) {
        const department = await transaction.department.findUnique({
          where: { departmentId: allocatedToDepartmentId },
          select: { headUserId: true },
        });
        notifyUserId = department?.headUserId ?? null;
      }

      if (notifyUserId) {
        await createNotification(
          {
            userId: notifyUserId,
            type: "AssetAssigned",
            message: `${asset.assetTag} (${asset.name}) has been allocated to you.`,
            linkPath: "/allocations",
          },
          transaction,
        );
      }

      return allocation;
    });

    return response.status(201).json({ allocation: result });
  } catch (error) {
    if (error instanceof AssetNotFoundError || error?.code === "P2003") {
      return response.status(404).json({ message: "Asset not found." });
    }
    if (error instanceof RecipientNotFoundError) {
      return response
        .status(404)
        .json({ message: "The allocation recipient was not found." });
    }
    if (error instanceof AssetNotAvailableError) {
      const holder = error.holder;
      const holderName = holder.holderUser?.name || holder.holderDepartment?.name;
      return response.status(409).json({
        message: holderName
          ? `This asset is currently held by ${holderName}. Request a transfer instead.`
          : `This asset is not available (status: ${holder.status}).`,
        conflict: {
          status: holder.status,
          currentHolderUser: holder.holderUser,
          currentHolderDepartment: holder.holderDepartment,
        },
      });
    }
    return next(error);
  }
}

function buildAllocationScope(user, query) {
  const where = {};

  if (
    typeof query.status === "string" &&
    ["Active", "ReturnRequested", "Returned"].includes(query.status)
  ) {
    where.status = query.status;
  } else if (query.scope === "active") {
    where.status = { in: activeAllocationStatuses };
  }

  const assetId = toPositiveInteger(query.assetId);
  if (assetId) {
    where.assetId = assetId;
  }

  // Role-based visibility.
  if (user.role === "Employee") {
    where.allocatedToUserId = user.userId;
  } else if (user.role === "DepartmentHead") {
    where.OR = [
      { allocatedToDepartmentId: user.departmentId ?? -1 },
      { allocatedToUser: { departmentId: user.departmentId ?? -1 } },
      { allocatedById: user.userId },
    ];
  }
  // AssetManager and Admin see everything.

  return where;
}

async function listAllocations(request, response, next) {
  const where = buildAllocationScope(request.user, request.query);

  try {
    const allocations = await prisma.assetAllocation.findMany({
      where,
      select: allocationSelect,
      orderBy: { allocationId: "desc" },
    });

    return response.status(200).json({ allocations });
  } catch (error) {
    return next(error);
  }
}

async function returnAllocation(request, response, next) {
  const allocationId = toPositiveInteger(request.params.allocationId);
  const unexpectedFields = findUnexpectedFields(request.body, [
    "checkInNotes",
    "returnCondition",
  ]);

  if (!allocationId) {
    return response.status(400).json({
      message: "Invalid request data.",
      errors: { allocationId: "Allocation ID must be a positive integer." },
    });
  }
  if (unexpectedFields.length > 0) {
    return response.status(400).json({
      message: "Invalid request data.",
      errors: { request: `Unexpected fields: ${unexpectedFields.join(", ")}.` },
    });
  }

  const checkInNotes = optionalTrimmedString(request.body?.checkInNotes);
  const returnCondition = optionalTrimmedString(request.body?.returnCondition);

  try {
    const result = await runSerializableTransaction(async (transaction) => {
      const allocation = await transaction.assetAllocation.findUnique({
        where: { allocationId },
        select: {
          allocationId: true,
          assetId: true,
          status: true,
          allocatedToUserId: true,
          asset: { select: { assetTag: true, name: true } },
        },
      });

      if (!allocation) {
        throw new AllocationNotFoundError();
      }

      if (!activeAllocationStatuses.includes(allocation.status)) {
        throw new AllocationNotReturnableError();
      }

      const updated = await transaction.assetAllocation.update({
        where: { allocationId },
        data: {
          status: "Returned",
          returnedAt: new Date(),
          checkInNotes,
          returnCondition,
        },
        select: allocationSelect,
      });

      await transaction.asset.update({
        where: { assetId: allocation.assetId },
        data: {
          status: "Available",
          currentHolderUserId: null,
          currentHolderDepartmentId: null,
        },
      });

      await logActivity(
        {
          actorUserId: request.user.userId,
          actionType: "AssetReturned",
          entityType: "Asset",
          entityId: allocation.assetId,
          details: `Return processed for ${allocation.asset.assetTag}.`,
        },
        transaction,
      );

      if (allocation.allocatedToUserId) {
        await createNotification(
          {
            userId: allocation.allocatedToUserId,
            type: "AssetReturned",
            message: `Your return of ${allocation.asset.assetTag} (${allocation.asset.name}) has been processed.`,
            linkPath: "/allocations",
          },
          transaction,
        );
      }

      return updated;
    });

    return response.status(200).json({ allocation: result });
  } catch (error) {
    if (error instanceof AllocationNotFoundError) {
      return response.status(404).json({ message: "Allocation not found." });
    }
    if (error instanceof AllocationNotReturnableError) {
      return response
        .status(409)
        .json({ message: "This allocation is not active and cannot be returned." });
    }
    return next(error);
  }
}

export { createAllocation, listAllocations, returnAllocation };
