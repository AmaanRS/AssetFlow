import validator from "validator";
import { prisma } from "../database/prisma.js";
import { logActivity } from "../services/activity-log.js";
import { createNotification } from "../services/notifications.js";
import { toPositiveInteger } from "../utils/validation.js";

const mysqlSignedIntMaximum = 2147483647;
const terminalBookingStatuses = ["Completed", "Cancelled"];
const openMaintenanceStatuses = [
  "Pending",
  "Approved",
  "TechnicianAssigned",
  "InProgress",
];
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

const bookingListSelect = {
  bookingId: true,
  assetId: true,
  userId: true,
  purpose: true,
  startTime: true,
  endTime: true,
  status: true,
  createdAt: true,
  asset: { select: { assetId: true, assetTag: true, name: true } },
  user: { select: { userId: true, name: true } },
};

class BookingNotFoundError extends Error {}
class BookingNotCancellableError extends Error {}

/** Derives a human-friendly booking status from stored status + times. */
function withDisplayStatus(booking, now) {
  let displayStatus = booking.status;
  if (booking.status === "Active") {
    if (now < new Date(booking.startTime)) displayStatus = "Upcoming";
    else if (now > new Date(booking.endTime)) displayStatus = "Completed";
    else displayStatus = "Ongoing";
  }
  return { ...booking, displayStatus };
}

async function listBookings(request, response, next) {
  const where = {};
  const assetId = toPositiveInteger(request.query.assetId);
  if (assetId) where.assetId = assetId;

  // Employees see their own bookings; managers/heads/admins see all.
  if (request.user.role === "Employee") {
    where.userId = request.user.userId;
  }

  try {
    const bookings = await prisma.booking.findMany({
      where,
      select: bookingListSelect,
      orderBy: { startTime: "desc" },
    });
    const now = new Date();
    return response
      .status(200)
      .json({ bookings: bookings.map((booking) => withDisplayStatus(booking, now)) });
  } catch (error) {
    return next(error);
  }
}

async function cancelBooking(request, response, next) {
  const bookingId = toPositiveInteger(request.params.bookingId);
  if (!bookingId) {
    return response.status(400).json({
      message: "Invalid request data.",
      errors: { bookingId: "Booking ID must be a positive integer." },
    });
  }

  const canManage = ["Admin", "AssetManager", "DepartmentHead"].includes(request.user.role);

  try {
    const result = await prisma.$transaction(async (transaction) => {
      const booking = await transaction.booking.findUnique({
        where: { bookingId },
        select: {
          bookingId: true,
          userId: true,
          status: true,
          asset: { select: { assetTag: true, name: true } },
        },
      });

      if (!booking) throw new BookingNotFoundError();
      if (booking.userId !== request.user.userId && !canManage) {
        throw new BookingNotCancellableError();
      }
      if (booking.status !== "Active") throw new BookingNotCancellableError();

      const updated = await transaction.booking.update({
        where: { bookingId },
        data: { status: "Cancelled" },
        select: bookingListSelect,
      });

      await logActivity(
        {
          actorUserId: request.user.userId,
          actionType: "BookingCancelled",
          entityType: "Booking",
          entityId: bookingId,
          details: `Cancelled booking for ${booking.asset.assetTag}.`,
        },
        transaction,
      );

      if (booking.userId !== request.user.userId) {
        await createNotification(
          {
            userId: booking.userId,
            type: "BookingCancelled",
            message: `Your booking of ${booking.asset.assetTag} (${booking.asset.name}) was cancelled.`,
            linkPath: "/bookings",
          },
          transaction,
        );
      }

      return updated;
    });

    const now = new Date();
    return response.status(200).json({ booking: withDisplayStatus(result, now) });
  } catch (error) {
    if (error instanceof BookingNotFoundError) {
      return response.status(404).json({ message: "Booking not found." });
    }
    if (error instanceof BookingNotCancellableError) {
      return response.status(409).json({ message: "This booking cannot be cancelled." });
    }
    return next(error);
  }
}

export { cancelBooking, createBooking, listBookings };
