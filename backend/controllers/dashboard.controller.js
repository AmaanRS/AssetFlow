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
  const activeAllocationStatuses = ["Active", "ReturnRequested"];

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
      // Active bookings = currently ongoing (started, not yet ended).
      prisma.booking.count({
        where: {
          status: "Active",
          startTime: { lte: now },
          endTime: { gt: now },
        },
      }),
      // Pending transfers awaiting approval.
      prisma.transferRequest.count({ where: { status: "Requested" } }),
      // Upcoming returns = active allocations due within the next 7 days.
      prisma.assetAllocation.count({
        where: {
          status: { in: activeAllocationStatuses },
          expectedReturnDate: { gte: now, lt: upcomingReturnEnd },
        },
      }),
      // Overdue returns = active allocations past their expected return date.
      prisma.assetAllocation.count({
        where: {
          status: { in: activeAllocationStatuses },
          expectedReturnDate: { lt: now },
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
