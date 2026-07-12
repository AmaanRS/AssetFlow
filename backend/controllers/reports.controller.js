import { prisma } from "../database/prisma.js";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

async function getReports(_request, response, next) {
  try {
    const [assets, categories, departments, allocations, maintenance, bookings] =
      await prisma.$transaction([
        prisma.asset.findMany({
          select: {
            assetId: true,
            assetTag: true,
            name: true,
            status: true,
            categoryId: true,
            currentHolderUserId: true,
            currentHolderDepartmentId: true,
            currentHolderUser: { select: { departmentId: true } },
          },
        }),
        prisma.assetCategory.findMany({ select: { categoryId: true, name: true } }),
        prisma.department.findMany({ select: { departmentId: true, name: true } }),
        prisma.assetAllocation.findMany({
          select: { assetId: true, status: true },
        }),
        prisma.maintenanceRequest.findMany({
          select: { assetId: true, status: true },
        }),
        prisma.booking.findMany({ select: { startTime: true, status: true } }),
      ]);

    const categoryName = new Map(categories.map((c) => [c.categoryId, c.name]));
    const departmentName = new Map(departments.map((d) => [d.departmentId, d.name]));

    // Status breakdown
    const statusBreakdown = {};
    for (const asset of assets) {
      statusBreakdown[asset.status] = (statusBreakdown[asset.status] ?? 0) + 1;
    }

    // Category breakdown
    const categoryBreakdown = {};
    for (const asset of assets) {
      const name = categoryName.get(asset.categoryId) ?? "Uncategorized";
      categoryBreakdown[name] = (categoryBreakdown[name] ?? 0) + 1;
    }

    // Allocation count per asset (all-time) => most used / idle
    const allocationCountByAsset = new Map();
    for (const allocation of allocations) {
      allocationCountByAsset.set(
        allocation.assetId,
        (allocationCountByAsset.get(allocation.assetId) ?? 0) + 1,
      );
    }
    const mostUsedAssets = assets
      .map((asset) => ({
        assetTag: asset.assetTag,
        name: asset.name,
        allocations: allocationCountByAsset.get(asset.assetId) ?? 0,
      }))
      .sort((a, b) => b.allocations - a.allocations)
      .slice(0, 5)
      .filter((entry) => entry.allocations > 0);

    const idleAssets = assets
      .filter(
        (asset) =>
          asset.status === "Available" &&
          !allocationCountByAsset.get(asset.assetId),
      )
      .map((asset) => ({ assetTag: asset.assetTag, name: asset.name }))
      .slice(0, 10);

    // Department allocation: assets currently held, grouped by department
    const departmentAllocation = {};
    for (const asset of assets) {
      if (asset.status !== "Allocated") continue;
      const deptId = asset.currentHolderDepartmentId ?? asset.currentHolderUser?.departmentId;
      const name = deptId ? departmentName.get(deptId) ?? `Dept #${deptId}` : "Unassigned";
      departmentAllocation[name] = (departmentAllocation[name] ?? 0) + 1;
    }

    // Maintenance frequency by category
    const maintenanceByCategory = {};
    const assetCategoryLookup = new Map(assets.map((a) => [a.assetId, a.categoryId]));
    for (const request_ of maintenance) {
      const catId = assetCategoryLookup.get(request_.assetId);
      const name = categoryName.get(catId) ?? "Uncategorized";
      maintenanceByCategory[name] = (maintenanceByCategory[name] ?? 0) + 1;
    }

    // Booking heatmap by weekday
    const bookingHeatmap = WEEKDAYS.map((day) => ({ day, count: 0 }));
    for (const booking of bookings) {
      if (booking.status === "Cancelled") continue;
      const weekday = new Date(booking.startTime).getDay();
      bookingHeatmap[weekday].count += 1;
    }

    const totalAssets = assets.length;
    const allocatedAssets = assets.filter((a) => a.status === "Allocated").length;

    return response.status(200).json({
      totals: {
        totalAssets,
        allocatedAssets,
        availableAssets: statusBreakdown.Available ?? 0,
        underMaintenance: statusBreakdown.UnderMaintenance ?? 0,
        utilizationRate: totalAssets ? Math.round((allocatedAssets / totalAssets) * 100) : 0,
      },
      statusBreakdown: toArray(statusBreakdown, "status"),
      categoryBreakdown: toArray(categoryBreakdown, "category"),
      departmentAllocation: toArray(departmentAllocation, "department"),
      maintenanceByCategory: toArray(maintenanceByCategory, "category"),
      mostUsedAssets,
      idleAssets,
      bookingHeatmap,
    });
  } catch (error) {
    return next(error);
  }
}

function toArray(record, keyName) {
  return Object.entries(record).map(([name, count]) => ({ [keyName]: name, count }));
}

export { getReports };
