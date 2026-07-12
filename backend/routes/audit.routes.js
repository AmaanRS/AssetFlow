import { Router } from "express";
import { PERMISSIONS } from "../config/roles.js";
import {
  addAuditor,
  closeAuditCycle,
  createAuditCycle,
  getAuditCycle,
  listAuditCycles,
  verifyAsset,
} from "../controllers/audit.controller.js";
import { authenticate, authorize } from "../middleware/auth.middleware.js";

const auditRoutes = Router();

auditRoutes.get("/", authenticate, authorize(PERMISSIONS.READ_ASSET), listAuditCycles);
auditRoutes.post("/", authenticate, authorize(PERMISSIONS.MANAGE_AUDIT), createAuditCycle);
auditRoutes.get("/:auditCycleId", authenticate, authorize(PERMISSIONS.READ_ASSET), getAuditCycle);
auditRoutes.post("/:auditCycleId/assignments", authenticate, authorize(PERMISSIONS.MANAGE_AUDIT), addAuditor);
auditRoutes.post("/:auditCycleId/verifications", authenticate, authorize(PERMISSIONS.VERIFY_AUDIT_ASSET), verifyAsset);
auditRoutes.patch("/:auditCycleId/close", authenticate, authorize(PERMISSIONS.MANAGE_AUDIT), closeAuditCycle);

export { auditRoutes };
