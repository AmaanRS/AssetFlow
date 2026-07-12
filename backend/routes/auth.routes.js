import { Router } from "express";
import {
  forgotPassword,
  login,
  resetPassword,
  signup,
  validateSession,
} from "../controllers/auth.controller.js";

const authRoutes = Router();

authRoutes.post("/signup", signup);
authRoutes.post("/login", login);
authRoutes.post("/forgot-password", forgotPassword);
authRoutes.post("/reset-password", resetPassword);
authRoutes.get("/session", validateSession);

export { authRoutes };
