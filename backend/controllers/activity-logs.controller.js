import { prisma } from "../database/prisma.js";
import { toPositiveInteger } from "../utils/validation.js";

const activityLogSelect = {
  logId: true,
  actionType: true,
  entityType: true,
  entityId: true,
  details: true,
  timestamp: true,
  actor: { select: { userId: true, name: true, role: true } },
};

async function listActivityLogs(request, response, next) {
  const where = {};
  if (typeof request.query.entityType === "string" && request.query.entityType.trim()) {
    where.entityType = request.query.entityType.trim();
  }
  const entityId = toPositiveInteger(request.query.entityId);
  if (entityId) where.entityId = entityId;
  const actorUserId = toPositiveInteger(request.query.actorUserId);
  if (actorUserId) where.actorUserId = actorUserId;

  try {
    const activityLogs = await prisma.activityLog.findMany({
      where,
      select: activityLogSelect,
      orderBy: { timestamp: "desc" },
      take: 100,
    });
    return response.status(200).json({ activityLogs });
  } catch (error) {
    return next(error);
  }
}

export { listActivityLogs };
