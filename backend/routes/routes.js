import { Router } from "express";
import { activityLogsRoutes } from "./activity-logs.routes.js";
import { allocationsRoutes } from "./allocations.routes.js";
import { assetsRoutes } from "./assets.routes.js";
import { auditRoutes } from "./audit.routes.js";
import { authRoutes } from "./auth.routes.js";
import { bookingsRoutes } from "./bookings.routes.js";
import { categoriesRoutes } from "./categories.routes.js";
import { dashboardRoutes } from "./dashboard.routes.js";
import { departmentsRoutes } from "./departments.routes.js";
import { maintenanceRequestsRoutes } from "./maintenance-requests.routes.js";
import { notificationsRoutes } from "./notifications.routes.js";
import { reportsRoutes } from "./reports.routes.js";
import { returnRequestsRoutes } from "./return-requests.routes.js";
import { transfersRoutes } from "./transfers.routes.js";
import { usersRoutes } from "./users.routes.js";

const routes = Router();

routes.use("/activity-logs", activityLogsRoutes);
routes.use("/allocations", allocationsRoutes);
routes.use("/assets", assetsRoutes);
routes.use("/audit-cycles", auditRoutes);
routes.use("/auth", authRoutes);
routes.use("/bookings", bookingsRoutes);
routes.use("/categories", categoriesRoutes);
routes.use("/dashboard", dashboardRoutes);
routes.use("/departments", departmentsRoutes);
routes.use("/maintenance-requests", maintenanceRequestsRoutes);
routes.use("/notifications", notificationsRoutes);
routes.use("/reports", reportsRoutes);
routes.use("/return-requests", returnRequestsRoutes);
routes.use("/transfers", transfersRoutes);
routes.use("/users", usersRoutes);

export { routes };
