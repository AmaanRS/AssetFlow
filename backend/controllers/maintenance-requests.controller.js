import { prisma } from "../database/prisma.js";

const MYSQL_INT_MAX = 2147483647;
const OPEN_MAINTENANCE_STATUSES = ["Pending", "Approved", "InProgress"];
const MAX_TRANSACTION_ATTEMPTS = 3;

const publicMaintenanceRequestSelect = {
  maintenanceRequestId: true,
  assetId: true,
  raisedByUserId: true,
  approvedByUserId: true,
  status: true,
  raisedAt: true,
  approvedAt: true,
  workStartedAt: true,
  workCompletedAt: true,
};

class AssetNotFoundError extends Error {}

class OpenMaintenanceRequestError extends Error {}

function validateMaintenanceRequest(body) {
  const errors = {};
  const unexpectedFields = Object.keys(body ?? {}).filter(
    (field) => field !== "assetId",
  );

  if (
    !Number.isInteger(body?.assetId) ||
    body.assetId <= 0 ||
    body.assetId > MYSQL_INT_MAX
  ) {
    errors.assetId = "Asset ID must be a positive integer.";
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

async function createMaintenanceRequest(request, response, next) {
  const errors = validateMaintenanceRequest(request.body);

  if (Object.keys(errors).length > 0) {
    return response.status(400).json({
      message: "Invalid request data.",
      errors,
    });
  }

  try {
    const maintenanceRequest = await runSerializableTransaction(
      async (transaction) => {
        const asset = await transaction.asset.findUnique({
          where: { assetId: request.body.assetId },
          select: { assetId: true },
        });

        if (!asset) {
          throw new AssetNotFoundError();
        }

        const existingRequest = await transaction.maintenanceRequest.findFirst({
          where: {
            assetId: request.body.assetId,
            status: { in: OPEN_MAINTENANCE_STATUSES },
          },
          select: { maintenanceRequestId: true },
        });

        if (existingRequest) {
          throw new OpenMaintenanceRequestError();
        }

        return transaction.maintenanceRequest.create({
          data: {
            assetId: request.body.assetId,
            raisedByUserId: request.user.userId,
            status: "Pending",
          },
          select: publicMaintenanceRequestSelect,
        });
      },
    );

    return response.status(201).json({ maintenanceRequest });
  } catch (error) {
    if (error instanceof AssetNotFoundError) {
      return response.status(404).json({ message: "Asset not found." });
    }

    if (error instanceof OpenMaintenanceRequestError) {
      return response.status(409).json({
        message: "An open maintenance request already exists for this asset.",
      });
    }

    return next(error);
  }
}

export { createMaintenanceRequest };
