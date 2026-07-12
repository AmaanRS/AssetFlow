import { Router } from "express";
import { PERMISSIONS } from "../config/roles.js";
import {
  createAsset,
  getAsset,
  getAssetHistory,
  listAssets,
  updateAsset,
} from "../controllers/assets.controller.js";
import { authenticate, authorize } from "../middleware/auth.middleware.js";

const assetsRoutes = Router();

assetsRoutes.get("/", authenticate, authorize(PERMISSIONS.READ_ASSET), listAssets);
assetsRoutes.post(
  "/",
  authenticate,
  authorize(PERMISSIONS.CREATE_ASSET),
  createAsset,
);
assetsRoutes.get(
  "/:assetId",
  authenticate,
  authorize(PERMISSIONS.READ_ASSET),
  getAsset,
);
assetsRoutes.get(
  "/:assetId/history",
  authenticate,
  authorize(PERMISSIONS.READ_ASSET),
  getAssetHistory,
);
assetsRoutes.patch(
  "/:assetId",
  authenticate,
  authorize(PERMISSIONS.UPDATE_ASSET),
  updateAsset,
);

export { assetsRoutes };
