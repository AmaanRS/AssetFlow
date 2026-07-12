import { Router } from "express";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../controllers/notifications.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

const notificationsRoutes = Router();

notificationsRoutes.get("/", authenticate, listNotifications);
notificationsRoutes.patch("/read-all", authenticate, markAllNotificationsRead);
notificationsRoutes.patch("/:notificationId/read", authenticate, markNotificationRead);

export { notificationsRoutes };
