import { prisma } from "../database/prisma.js";
import { toPositiveInteger } from "../utils/validation.js";

const notificationSelect = {
  notificationId: true,
  type: true,
  message: true,
  linkPath: true,
  readStatus: true,
  createdAt: true,
};

async function listNotifications(request, response, next) {
  const where = { userId: request.user.userId };
  if (request.query.unread === "true") {
    where.readStatus = false;
  }

  try {
    const [notifications, unreadCount] = await prisma.$transaction([
      prisma.notification.findMany({
        where,
        select: notificationSelect,
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.notification.count({
        where: { userId: request.user.userId, readStatus: false },
      }),
    ]);

    return response.status(200).json({ notifications, unreadCount });
  } catch (error) {
    return next(error);
  }
}

async function markNotificationRead(request, response, next) {
  const notificationId = toPositiveInteger(request.params.notificationId);
  if (!notificationId) {
    return response.status(400).json({
      message: "Invalid request data.",
      errors: { notificationId: "ID must be a positive integer." },
    });
  }

  try {
    const result = await prisma.notification.updateMany({
      where: { notificationId, userId: request.user.userId },
      data: { readStatus: true },
    });

    if (result.count === 0) {
      return response.status(404).json({ message: "Notification not found." });
    }

    return response.status(200).json({ message: "Notification marked as read." });
  } catch (error) {
    return next(error);
  }
}

async function markAllNotificationsRead(request, response, next) {
  try {
    await prisma.notification.updateMany({
      where: { userId: request.user.userId, readStatus: false },
      data: { readStatus: true },
    });
    return response.status(200).json({ message: "All notifications marked as read." });
  } catch (error) {
    return next(error);
  }
}

export { listNotifications, markAllNotificationsRead, markNotificationRead };
