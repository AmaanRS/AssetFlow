import validator from "validator";
import { prisma } from "../database/prisma.js";

const mysqlSignedIntMaximum = 2147483647;
const terminalBookingStatuses = ["Completed", "Cancelled"];
const openMaintenanceStatuses = ["Pending", "Approved", "InProgress"];
const transactionRetryLimit = 3;

const publicBookingSelect = {
  bookingId: true,
  assetId: true,
  userId: true,
  startTime: true,
  endTime: true,
  status: true,
  createdAt: true,
};

class AssetNotFoundError extends Error {}

class AssetNotSharedError extends Error {}

class AssetNotAvailableError extends Error {}

class OpenMaintenanceRequestError extends Error {}

class BookingOverlapError extends Error {}

function parseIsoDateTime(value) {
  if (typeof value !== "string" || !validator.isRFC3339(value)) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function validateCreateBookingRequest(body, now) {
  const errors = {};
  const allowedFields = ["assetId", "startTime", "endTime"];
  const unexpectedFields = Object.keys(body ?? {}).filter(
    (field) => !allowedFields.includes(field),
  );
  const startTime = parseIsoDateTime(body?.startTime);
  const endTime = parseIsoDateTime(body?.endTime);

  if (
    !Number.isInteger(body?.assetId) ||
    body.assetId <= 0 ||
    body.assetId > mysqlSignedIntMaximum
  ) {
    errors.assetId = "Asset ID must be a positive integer.";
  }

  if (!startTime) {
    errors.startTime =
      "startTime must be a valid ISO-8601 date-time with a timezone.";
  } else if (startTime <= now) {
    errors.startTime = "startTime must be in the future.";
  }

  if (!endTime) {
    errors.endTime =
      "endTime must be a valid ISO-8601 date-time with a timezone.";
  } else if (startTime && endTime <= startTime) {
    errors.endTime = "endTime must be after startTime.";
  }

  if (unexpectedFields.length > 0) {
    errors.request = `Unexpected fields: ${unexpectedFields.join(", ")}.`;
  }

  return { endTime, errors, startTime };
}

async function createBookingInTransaction({
  assetId,
  endTime,
  startTime,
  userId,
}) {
  return prisma.$transaction(
    async (transaction) => {
      const asset = await transaction.asset.findUnique({
        where: { assetId },
        select: {
          assetId: true,
          isSharedResource: true,
          status: true,
        },
      });

      if (!asset) {
        throw new AssetNotFoundError();
      }

      if (!asset.isSharedResource) {
        throw new AssetNotSharedError();
      }

      if (asset.status !== "Available") {
        throw new AssetNotAvailableError();
      }

      const openMaintenanceRequest =
        await transaction.maintenanceRequest.findFirst({
          where: {
            assetId,
            status: { in: openMaintenanceStatuses },
          },
          select: { maintenanceRequestId: true },
        });

      if (openMaintenanceRequest) {
        throw new OpenMaintenanceRequestError();
      }

      const overlappingBooking = await transaction.booking.findFirst({
        where: {
          assetId,
          status: { notIn: terminalBookingStatuses },
          startTime: { lt: endTime },
          endTime: { gt: startTime },
        },
        select: { bookingId: true },
      });

      if (overlappingBooking) {
        throw new BookingOverlapError();
      }

      return transaction.booking.create({
        data: {
          assetId,
          userId,
          startTime,
          endTime,
          status: "Active",
        },
        select: publicBookingSelect,
      });
    },
    { isolationLevel: "Serializable" },
  );
}

async function createBooking(request, response, next) {
  const { endTime, errors, startTime } = validateCreateBookingRequest(
    request.body,
    new Date(),
  );

  if (Object.keys(errors).length > 0) {
    return response.status(400).json({
      message: "Invalid request data.",
      errors,
    });
  }

  try {
    let booking;

    for (let attempt = 1; attempt <= transactionRetryLimit; attempt += 1) {
      try {
        booking = await createBookingInTransaction({
          assetId: request.body.assetId,
          endTime,
          startTime,
          userId: request.user.userId,
        });
        break;
      } catch (error) {
        if (error?.code !== "P2034" || attempt === transactionRetryLimit) {
          throw error;
        }
      }
    }

    return response.status(201).json({ booking });
  } catch (error) {
    if (error instanceof AssetNotFoundError || error?.code === "P2003") {
      return response.status(404).json({ message: "Asset not found." });
    }

    if (error instanceof AssetNotSharedError) {
      return response.status(409).json({
        message: "Only shared resources can be booked.",
      });
    }

    if (error instanceof AssetNotAvailableError) {
      return response.status(409).json({
        message: "The shared resource is not available for booking.",
      });
    }

    if (error instanceof OpenMaintenanceRequestError) {
      return response.status(409).json({
        message: "The shared resource has an open maintenance request.",
      });
    }

    if (error instanceof BookingOverlapError) {
      return response.status(409).json({
        message: "The asset is already booked for the requested time.",
      });
    }

    return next(error);
  }
}

export { createBooking };
