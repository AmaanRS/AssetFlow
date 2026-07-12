import { Router } from "express";
import { PERMISSIONS } from "../config/roles.js";
import { createAsset } from "../controllers/assets.controller.js";
import { authenticate, authorize } from "../middleware/auth.middleware.js";

const assetsRoutes = Router();

assetsRoutes.post(
  "/",
  authenticate,
  authorize(PERMISSIONS.CREATE_ASSET),
  createAsset,
);

export { assetsRoutes };
