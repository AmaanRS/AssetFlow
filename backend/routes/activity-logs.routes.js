import { Router } from "express";
import { PERMISSIONS } from "../config/roles.js";
import { listActivityLogs } from "../controllers/activity-logs.controller.js";
import { authenticate, authorize } from "../middleware/auth.middleware.js";

const activityLogsRoutes = Router();

activityLogsRoutes.get(
  "/",
  authenticate,
  authorize(PERMISSIONS.READ_REPORTS),
  listActivityLogs,
);

export { activityLogsRoutes };
