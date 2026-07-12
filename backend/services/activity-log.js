import { prisma } from "../database/prisma.js";

const MAX_DETAILS_LENGTH = 60000;

function serializeDetails(details) {
  if (details == null) {
    return null;
  }

  const text = typeof details === "string" ? details : JSON.stringify(details);
  return text.length > MAX_DETAILS_LENGTH
    ? text.slice(0, MAX_DETAILS_LENGTH)
    : text;
}

/**
 * Writes an activity-log entry describing who did what, to which entity.
 *
 * Pass a transaction client as the second argument to make the log part of an
 * atomic operation; otherwise the shared prisma client is used.
 */
async function logActivity(
  { actorUserId, actionType, entityType, entityId, details = null },
  client = prisma,
) {
  return client.activityLog.create({
    data: {
      actorUserId,
      actionType,
      entityType,
      entityId,
      details: serializeDetails(details),
    },
  });
}

export { logActivity };
