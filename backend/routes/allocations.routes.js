import { Router } from "express";
import { PERMISSIONS } from "../config/roles.js";
import {
  createAllocation,
  listAllocations,
  returnAllocation,
} from "../controllers/allocations.controller.js";
import { authenticate, authorize } from "../middleware/auth.middleware.js";

const allocationsRoutes = Router();

allocationsRoutes.get(
  "/",
  authenticate,
  authorize(PERMISSIONS.READ_ASSET),
  listAllocations,
);
allocationsRoutes.post(
  "/",
  authenticate,
  authorize(PERMISSIONS.ALLOCATE_ASSET),
  createAllocation,
);
allocationsRoutes.patch(
  "/:allocationId/return",
  authenticate,
  authorize(PERMISSIONS.APPROVE_ASSET_RETURN),
  returnAllocation,
);

export { allocationsRoutes };
