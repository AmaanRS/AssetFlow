import { Router } from "express";
import { PERMISSIONS } from "../config/roles.js";
import {
  createDepartment,
  listDepartments,
  updateDepartment,
} from "../controllers/departments.controller.js";
import { authenticate, authorize } from "../middleware/auth.middleware.js";

const departmentsRoutes = Router();

departmentsRoutes.get("/", authenticate, listDepartments);
departmentsRoutes.post(
  "/",
  authenticate,
  authorize(PERMISSIONS.MANAGE_DEPARTMENT),
  createDepartment,
);
departmentsRoutes.patch(
  "/:departmentId",
  authenticate,
  authorize(PERMISSIONS.MANAGE_DEPARTMENT),
  updateDepartment,
);

export { departmentsRoutes };
