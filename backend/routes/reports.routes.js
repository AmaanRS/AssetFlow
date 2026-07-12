import { Router } from "express";
import { PERMISSIONS } from "../config/roles.js";
import { getReports } from "../controllers/reports.controller.js";
import { authenticate, authorize } from "../middleware/auth.middleware.js";

const reportsRoutes = Router();

reportsRoutes.get("/", authenticate, authorize(PERMISSIONS.READ_REPORTS), getReports);

export { reportsRoutes };
