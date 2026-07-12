import { Router } from "express";
import { PERMISSIONS } from "../config/roles.js";
import {
  approveMaintenanceRequest,
  assignTechnician,
  createMaintenanceRequest,
  listMaintenanceRequests,
  rejectMaintenanceRequest,
  resolveMaintenance,
  startMaintenance,
} from "../controllers/maintenance-requests.controller.js";
import { authenticate, authorize } from "../middleware/auth.middleware.js";

const maintenanceRequestsRoutes = Router();

maintenanceRequestsRoutes.get(
  "/",
  authenticate,
  authorize(PERMISSIONS.READ_ASSET),
  listMaintenanceRequests,
);
maintenanceRequestsRoutes.post(
  "/",
  authenticate,
  authorize(PERMISSIONS.RAISE_MAINTENANCE_REQUEST),
  createMaintenanceRequest,
);
maintenanceRequestsRoutes.patch(
  "/:maintenanceRequestId/approve",
  authenticate,
  authorize(PERMISSIONS.APPROVE_MAINTENANCE_REQUEST),
  approveMaintenanceRequest,
);
maintenanceRequestsRoutes.patch(
  "/:maintenanceRequestId/reject",
  authenticate,
  authorize(PERMISSIONS.APPROVE_MAINTENANCE_REQUEST),
  rejectMaintenanceRequest,
);
maintenanceRequestsRoutes.patch(
  "/:maintenanceRequestId/assign",
  authenticate,
  authorize(PERMISSIONS.APPROVE_MAINTENANCE_REQUEST),
  assignTechnician,
);
maintenanceRequestsRoutes.patch(
  "/:maintenanceRequestId/start",
  authenticate,
  authorize(PERMISSIONS.APPROVE_MAINTENANCE_REQUEST),
  startMaintenance,
);
maintenanceRequestsRoutes.patch(
  "/:maintenanceRequestId/resolve",
  authenticate,
  authorize(PERMISSIONS.APPROVE_MAINTENANCE_REQUEST),
  resolveMaintenance,
);

export { maintenanceRequestsRoutes };
