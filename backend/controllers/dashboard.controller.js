import { prisma } from "../database/prisma.js";

const upcomingReturnWindowMilliseconds = 7 * 24 * 60 * 60 * 1000;

function createTimeBoundaries(now) {
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);

  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setUTCDate(tomorrowStart.getUTCDate() + 1);

  return {
    now,
    todayStart,
    tomorrowStart,
    upcomingReturnEnd: new Date(
      now.getTime() + upcomingReturnWindowMilliseconds,
    ),
  };
}

async function getDashboardSummary(_request, response, next) {
  const { now, todayStart, tomorrowStart, upcomingReturnEnd } =
    createTimeBoundaries(new Date());
  const activeStartedBooking = {
    status: "Active",
    startTime: { lte: now },
  };

  try {
    const [
      assetsAvailable,
      assetsAllocated,
      maintenanceToday,
      activeBookings,
      pendingTransfers,
      upcomingReturns,
      overdueReturns,
    ] = await prisma.$transaction([
      prisma.asset.count({ where: { status: "Available" } }),
      prisma.asset.count({ where: { status: "Allocated" } }),
      prisma.maintenanceRequest.count({
        where: {
          raisedAt: {
            gte: todayStart,
            lt: tomorrowStart,
          },
        },
      }),
      prisma.booking.count({
        where: {
          ...activeStartedBooking,
          endTime: { gt: now },
        },
      }),
      prisma.transferRequest.count({ where: { status: "Pending" } }),
      prisma.booking.count({
        where: {
          ...activeStartedBooking,
          endTime: {
            gte: now,
            lt: upcomingReturnEnd,
          },
        },
      }),
      prisma.booking.count({
        where: {
          ...activeStartedBooking,
          endTime: { lt: now },
        },
      }),
    ]);

    return response.status(200).json({
      assetsAvailable,
      assetsAllocated,
      maintenanceToday,
      activeBookings,
      pendingTransfers,
      upcomingReturns,
      overdueReturns,
    });
  } catch (error) {
    return next(error);
  }
}

export { getDashboardSummary };
