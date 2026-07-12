import { Router } from "express";
import { PERMISSIONS } from "../config/roles.js";
import { createReturnRequest } from "../controllers/return-requests.controller.js";
import { authenticate, authorize } from "../middleware/auth.middleware.js";

const returnRequestsRoutes = Router();

returnRequestsRoutes.post(
  "/",
  authenticate,
  authorize(PERMISSIONS.RAISE_ASSET_RETURN),
  createReturnRequest,
);

export { returnRequestsRoutes };
