import { prisma } from "../database/prisma.js";

const MYSQL_INT_MAX = 2147483647;
const MAX_TRANSACTION_ATTEMPTS = 3;

const publicReturnRequestSelect = {
  allocationId: true,
  assetId: true,
  status: true,
};

const returnRequestLookupSelect = {
  allocationId: true,
  allocatedToUserId: true,
  returnedAt: true,
  status: true,
};

class AllocationNotFoundError extends Error {}

class AllocationNotActiveError extends Error {}

function validateReturnRequest(body) {
  const errors = {};
  const unexpectedFields = Object.keys(body ?? {}).filter(
    (field) => field !== "allocationId",
  );

  if (
    !Number.isInteger(body?.allocationId) ||
    body.allocationId <= 0 ||
    body.allocationId > MYSQL_INT_MAX
  ) {
    errors.allocationId = "Allocation ID must be a positive integer.";
  }

  if (unexpectedFields.length > 0) {
    errors.request = `Unexpected fields: ${unexpectedFields.join(", ")}.`;
  }

  return errors;
}

async function runSerializableTransaction(work) {
  for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction(work, {
        isolationLevel: "Serializable",
      });
    } catch (error) {
      if (error?.code !== "P2034" || attempt === MAX_TRANSACTION_ATTEMPTS) {
        throw error;
      }
    }
  }

  throw new Error("Unable to complete the transaction.");
}

async function createReturnRequest(request, response, next) {
  const errors = validateReturnRequest(request.body);

  if (Object.keys(errors).length > 0) {
    return response.status(400).json({
      message: "Invalid request data.",
      errors,
    });
  }

  try {
    const returnRequest = await runSerializableTransaction(
      async (transaction) => {
        const allocation = await transaction.assetAllocation.findUnique({
          where: { allocationId: request.body.allocationId },
          select: returnRequestLookupSelect,
        });

        if (
          !allocation ||
          allocation.allocatedToUserId !== request.user.userId
        ) {
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

        return transaction.assetAllocation.findUnique({
          where: { allocationId: request.body.allocationId },
          select: publicReturnRequestSelect,
        });
      },
    );

    return response.status(202).json({ returnRequest });
  } catch (error) {
    if (error instanceof AllocationNotFoundError) {
      return response.status(404).json({ message: "Allocation not found." });
    }

    if (error instanceof AllocationNotActiveError) {
      return response.status(409).json({
        message:
          "Only active, unreturned allocations can have a return requested.",
      });
    }

    return next(error);
  }
}

export { createReturnRequest };
