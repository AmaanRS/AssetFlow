import { prisma } from "../database/prisma.js";

/**
 * Creates a single notification for a user.
 *
 * Pass a transaction client as the second argument to make the notification
 * part of an atomic operation; otherwise the shared prisma client is used.
 */
async function createNotification(
  { userId, type, message, linkPath = null },
  client = prisma,
) {
  if (!userId) {
    return null;
  }

  return client.notification.create({
    data: { userId, type, message, linkPath },
  });
}

/**
 * Creates notifications for many recipients at once. Entries without a userId
 * are skipped, and duplicate recipients are de-duplicated.
 */
async function createNotifications(entries, client = prisma) {
  const seen = new Set();
  const data = [];

  for (const entry of entries ?? []) {
    if (!entry?.userId || seen.has(entry.userId)) {
      continue;
    }

    seen.add(entry.userId);
    data.push({
      userId: entry.userId,
      type: entry.type,
      message: entry.message,
      linkPath: entry.linkPath ?? null,
    });
  }

  if (data.length === 0) {
    return { count: 0 };
  }

  return client.notification.createMany({ data });
}

export { createNotification, createNotifications };
