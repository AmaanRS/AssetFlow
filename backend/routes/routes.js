import { Router } from "express";
import { assetsRoutes } from "./assets.routes.js";
import { authRoutes } from "./auth.routes.js";
import { bookingsRoutes } from "./bookings.routes.js";
import { dashboardRoutes } from "./dashboard.routes.js";
import { maintenanceRequestsRoutes } from "./maintenance-requests.routes.js";
import { returnRequestsRoutes } from "./return-requests.routes.js";
import { usersRoutes } from "./users.routes.js";

const routes = Router();

routes.use("/assets", assetsRoutes);
routes.use("/auth", authRoutes);
routes.use("/bookings", bookingsRoutes);
routes.use("/dashboard", dashboardRoutes);
routes.use("/maintenance-requests", maintenanceRequestsRoutes);
routes.use("/return-requests", returnRequestsRoutes);
routes.use("/users", usersRoutes);

export { routes };
