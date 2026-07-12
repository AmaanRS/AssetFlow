import { prisma } from "../database/prisma.js";
import { logActivity } from "../services/activity-log.js";
import { createNotification } from "../services/notifications.js";
import { mysqlSignedIntMaximum, runSerializableTransaction } from "../utils/db.js";
import { findUnexpectedFields } from "../utils/validation.js";

const publicReturnRequestSelect = {
  allocationId: true,
  assetId: true,
  status: true,
};

const returnRequestLookupSelect = {
  allocationId: true,
  assetId: true,
  allocatedToUserId: true,
  allocatedById: true,
  returnedAt: true,
  status: true,
  asset: { select: { assetTag: true, name: true } },
};

class AllocationNotFoundError extends Error {}
class AllocationNotActiveError extends Error {}

function validateReturnRequest(body) {
  const errors = {};
  const unexpectedFields = findUnexpectedFields(body, ["allocationId"]);

  if (
    !Number.isInteger(body?.allocationId) ||
    body.allocationId <= 0 ||
    body.allocationId > mysqlSignedIntMaximum
  ) {
    errors.allocationId = "Allocation ID must be a positive integer.";
  }

  if (unexpectedFields.length > 0) {
    errors.request = `Unexpected fields: ${unexpectedFields.join(", ")}.`;
  }

  return errors;
}

async function createReturnRequest(request, response, next) {
  const errors = validateReturnRequest(request.body);

  if (Object.keys(errors).length > 0) {
    return response.status(400).json({ message: "Invalid request data.", errors });
  }

  try {
    const returnRequest = await runSerializableTransaction(async (transaction) => {
      const allocation = await transaction.assetAllocation.findUnique({
        where: { allocationId: request.body.allocationId },
        select: returnRequestLookupSelect,
      });

      if (!allocation || allocation.allocatedToUserId !== request.user.userId) {
        throw new AllocationNotFoundError();
      }

      if (allocation.status !== "Active" || allocation.returnedAt !== null) {
        throw new AllocationNotActiveError();
      }

      const transition = await transaction.assetAllocation.updateMany({
        where: {
          allocationId: request.body.allocationId,
          allocatedToUserId: request.user.userId,
          status: "Active",
          returnedAt: null,
        },
        data: { status: "ReturnRequested" },
      });

      if (transition.count !== 1) {
        throw new AllocationNotActiveError();
      }

      await logActivity(
        {
          actorUserId: request.user.userId,
          actionType: "ReturnRequested",
          entityType: "Asset",
          entityId: allocation.assetId,
          details: `Requested return of ${allocation.asset.assetTag}.`,
        },
        transaction,
      );

      if (allocation.allocatedById) {
        await createNotification(
          {
            userId: allocation.allocatedById,
            type: "ReturnRequested",
            message: `A return was requested for ${allocation.asset.assetTag} (${allocation.asset.name}).`,
            linkPath: "/allocations",
          },
          transaction,
        );
      }

      return transaction.assetAllocation.findUnique({
        where: { allocationId: request.body.allocationId },
        select: publicReturnRequestSelect,
      });
    });

    return response.status(202).json({ returnRequest });
  } catch (error) {
    if (error instanceof AllocationNotFoundError) {
      return response.status(404).json({ message: "Allocation not found." });
    }

    if (error instanceof AllocationNotActiveError) {
      return response.status(409).json({
        message: "Only active, unreturned allocations can have a return requested.",
      });
    }

    return next(error);
  }
}

export { createReturnRequest };
