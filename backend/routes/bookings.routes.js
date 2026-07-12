import { Router } from "express";
import { PERMISSIONS } from "../config/roles.js";
import {
  cancelBooking,
  createBooking,
  listBookings,
} from "../controllers/bookings.controller.js";
import { authenticate, authorize } from "../middleware/auth.middleware.js";

const bookingsRoutes = Router();

bookingsRoutes.get(
  "/",
  authenticate,
  authorize(PERMISSIONS.READ_ASSET),
  listBookings,
);
bookingsRoutes.post(
  "/",
  authenticate,
  authorize(PERMISSIONS.BOOK_SHARED_RESOURCE),
  createBooking,
);
bookingsRoutes.patch(
  "/:bookingId/cancel",
  authenticate,
  authorize(PERMISSIONS.BOOK_SHARED_RESOURCE),
  cancelBooking,
);

export { bookingsRoutes };
