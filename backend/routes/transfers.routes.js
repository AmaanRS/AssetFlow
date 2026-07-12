import { Router } from "express";
import { PERMISSIONS } from "../config/roles.js";
import {
  approveTransferRequest,
  createTransferRequest,
  listTransferRequests,
  rejectTransferRequest,
} from "../controllers/transfers.controller.js";
import { authenticate, authorize } from "../middleware/auth.middleware.js";

const transfersRoutes = Router();

transfersRoutes.get(
  "/",
  authenticate,
  authorize(PERMISSIONS.READ_ASSET),
  listTransferRequests,
);
transfersRoutes.post(
  "/",
  authenticate,
  authorize(PERMISSIONS.TRANSFER_ASSET),
  createTransferRequest,
);
transfersRoutes.patch(
  "/:transferRequestId/approve",
  authenticate,
  authorize(PERMISSIONS.APPROVE_ASSET_TRANSFER),
  approveTransferRequest,
);
transfersRoutes.patch(
  "/:transferRequestId/reject",
  authenticate,
  authorize(PERMISSIONS.APPROVE_ASSET_TRANSFER),
  rejectTransferRequest,
);

export { transfersRoutes };
