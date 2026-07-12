import { Router } from "express";
import { PERMISSIONS } from "../config/roles.js";
import {
  listUsers,
  promoteUser,
  updateUser,
} from "../controllers/users.controller.js";
import { authenticate, authorize } from "../middleware/auth.middleware.js";

const usersRoutes = Router();

usersRoutes.get(
  "/",
  authenticate,
  authorize(PERMISSIONS.READ_USER_DIRECTORY),
  listUsers,
);
usersRoutes.patch(
  "/:userId/role",
  authenticate,
  authorize(PERMISSIONS.UPDATE_USER),
  promoteUser,
);
usersRoutes.patch(
  "/:userId",
  authenticate,
  authorize(PERMISSIONS.UPDATE_USER),
  updateUser,
);

export { usersRoutes };
