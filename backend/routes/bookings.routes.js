import { Router } from "express";
import { PERMISSIONS } from "../config/roles.js";
import { createBooking } from "../controllers/bookings.controller.js";
import { authenticate, authorize } from "../middleware/auth.middleware.js";

const bookingsRoutes = Router();

bookingsRoutes.post(
  "/",
  authenticate,
  authorize(PERMISSIONS.BOOK_SHARED_RESOURCE),
  createBooking,
);

export { bookingsRoutes };
