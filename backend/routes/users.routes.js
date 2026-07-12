import { Router } from "express";
import { PERMISSIONS } from "../config/roles.js";
import { listUsers, promoteUser } from "../controllers/users.controller.js";
import { authenticate, authorize } from "../middleware/auth.middleware.js";

const usersRoutes = Router();

usersRoutes.get(
  "/",
  authenticate,
  authorize(PERMISSIONS.READ_USER),
  listUsers,
);
usersRoutes.patch(
  "/:userId/role",
  authenticate,
  authorize(PERMISSIONS.UPDATE_USER),
  promoteUser,
);

export { usersRoutes };
