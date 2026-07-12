import { Router } from "express";
import { PERMISSIONS } from "../config/roles.js";
import { createMaintenanceRequest } from "../controllers/maintenance-requests.controller.js";
import { authenticate, authorize } from "../middleware/auth.middleware.js";

const maintenanceRequestsRoutes = Router();

maintenanceRequestsRoutes.post(
  "/",
  authenticate,
  authorize(PERMISSIONS.RAISE_MAINTENANCE_REQUEST),
  createMaintenanceRequest,
);

export { maintenanceRequestsRoutes };
