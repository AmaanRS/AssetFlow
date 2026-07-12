import { Router } from "express";
import { PERMISSIONS } from "../config/roles.js";
import { getDashboardSummary } from "../controllers/dashboard.controller.js";
import { authenticate, authorize } from "../middleware/auth.middleware.js";

const dashboardRoutes = Router();

dashboardRoutes.get(
  "/summary",
  authenticate,
  authorize(PERMISSIONS.READ_ASSET),
  getDashboardSummary,
);

export { dashboardRoutes };
