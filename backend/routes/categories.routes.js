import { Router } from "express";
import { PERMISSIONS } from "../config/roles.js";
import {
  createCategory,
  listCategories,
  updateCategory,
} from "../controllers/categories.controller.js";
import { authenticate, authorize } from "../middleware/auth.middleware.js";

const categoriesRoutes = Router();

categoriesRoutes.get("/", authenticate, listCategories);
categoriesRoutes.post(
  "/",
  authenticate,
  authorize(PERMISSIONS.MANAGE_CATEGORY),
  createCategory,
);
categoriesRoutes.patch(
  "/:categoryId",
  authenticate,
  authorize(PERMISSIONS.MANAGE_CATEGORY),
  updateCategory,
);

export { categoriesRoutes };
