import { prisma } from "../database/prisma.js";
import { logActivity } from "../services/activity-log.js";
import { createNotification } from "../services/notifications.js";
import { runSerializableTransaction } from "../utils/db.js";
import {
  findUnexpectedFields,
  optionalTrimmedString,
  parseDate,
  toPositiveInteger,
} from "../utils/validation.js";

const VERIFIED_STATUSES = new Set(["Verified", "Missing", "Damaged"]);

const cycleSelect = {
  auditCycleId: true,
  name: true,
  scopeDepartmentId: true,
  scopeLocation: true,
  startDate: true,
  endDate: true,
  status: true,
  createdAt: true,
  assignments: {
    select: {
      auditAssignmentId: true,
      auditorUserId: true,
      status: true,
      auditor: { select: { userId: true, name: true, email: true } },
    },
  },
  _count: { select: { verifications: true } },
};

class CycleNotFoundError extends Error {}
class CycleClosedError extends Error {}
class NotAssignedError extends Error {}
class AssetNotInScopeError extends Error {}

async function listAuditCycles(_request, response, next) {
  try {
    const auditCycles = await prisma.auditCycle.findMany({
      select: cycleSelect,
      orderBy: { auditCycleId: "desc" },
    });
    return response.status(200).json({ auditCycles });
  } catch (error) {
    return next(error);
  }
}

async function createAuditCycle(request, response, next) {
  const errors = {};
  const unexpectedFields = findUnexpectedFields(request.body, [
    "name",
    "scopeDepartmentId",
    "scopeLocation",
    "startDate",
    "endDate",
  ]);
  const name = optionalTrimmedString(request.body?.name);
  const startDate = parseDate(request.body?.startDate);
  const endDate = parseDate(request.body?.endDate);
  const scopeDepartmentId =
    request.body?.scopeDepartmentId == null ? null : toPositiveInteger(request.body.scopeDepartmentId);

  if (!name) errors.name = "Audit cycle name is required.";
  if (!startDate) errors.startDate = "A valid start date is required.";
  if (!endDate) errors.endDate = "A valid end date is required.";
  if (startDate && endDate && endDate < startDate) errors.endDate = "End date must be on or after the start date.";
  if (unexpectedFields.length > 0) errors.request = `Unexpected fields: ${unexpectedFields.join(", ")}.`;

  if (Object.keys(errors).length > 0) {
    return response.status(400).json({ message: "Invalid request data.", errors });
  }

  try {
    const cycle = await prisma.auditCycle.create({
      data: {
        name,
        scopeDepartmentId,
        scopeLocation: optionalTrimmedString(request.body?.scopeLocation),
        startDate,
        endDate,
        status: "Open",
      },
      select: cycleSelect,
    });

    await logActivity({
      actorUserId: request.user.userId,
      actionType: "AuditCycleCreated",
      entityType: "AuditCycle",
      entityId: cycle.auditCycleId,
      details: `Created audit cycle "${cycle.name}".`,
    });

    return response.status(201).json({ auditCycle: cycle });
  } catch (error) {
    return next(error);
  }
}

function scopeWhere(cycle) {
  const where = {};
  if (cycle.scopeDepartmentId) {
    where.OR = [
      { currentHolderDepartmentId: cycle.scopeDepartmentId },
      { currentHolderUser: { departmentId: cycle.scopeDepartmentId } },
    ]
  }
  if (cycle.scopeLocation) {
    where.location = { contains: cycle.scopeLocation };
  }
  return where;
}

async function getAuditCycle(request, response, next) {
  const auditCycleId = toPositiveInteger(request.params.auditCycleId);
  if (!auditCycleId) {
    return response.status(400).json({ message: "Invalid request data.", errors: { auditCycleId: "ID must be a positive integer." } });
  }

  try {
    const cycle = await prisma.auditCycle.findUnique({
      where: { auditCycleId },
      select: {
        ...cycleSelect,
        discrepancyReports: {
          select: { reportId: true, summary: true, details: true, status: true, generatedAt: true },
          orderBy: { reportId: "desc" },
        },
      },
    });
    if (!cycle) return response.status(404).json({ message: "Audit cycle not found." });

    const assets = await prisma.asset.findMany({
      where: scopeWhere(cycle),
      select: {
        assetId: true,
        assetTag: true,
        name: true,
        status: true,
        location: true,
        verifications: {
          where: { auditCycleId },
          select: { verifiedStatus: true, remarks: true, auditor: { select: { name: true } }, verifiedAt: true },
        },
      },
      orderBy: { assetId: "asc" },
    });

    const scopedAssets = assets.map((asset) => ({
      assetId: asset.assetId,
      assetTag: asset.assetTag,
      name: asset.name,
      status: asset.status,
      location: asset.location,
      verification: asset.verifications[0] ?? null,
    }));

    return response.status(200).json({ auditCycle: cycle, assets: scopedAssets });
  } catch (error) {
    return next(error);
  }
}

async function addAuditor(request, response, next) {
  const auditCycleId = toPositiveInteger(request.params.auditCycleId);
  const auditorUserId = toPositiveInteger(request.body?.auditorUserId);

  if (!auditCycleId || !auditorUserId) {
    return response.status(400).json({ message: "Invalid request data.", errors: { auditorUserId: "A valid auditor user ID is required." } });
  }

  try {
    const cycle = await prisma.auditCycle.findUnique({ where: { auditCycleId }, select: { status: true } });
    if (!cycle) return response.status(404).json({ message: "Audit cycle not found." });
    if (cycle.status !== "Open") return response.status(409).json({ message: "Cannot assign auditors to a closed cycle." });

    await prisma.auditAssignment.upsert({
      where: { auditCycleId_auditorUserId: { auditCycleId, auditorUserId } },
      update: {},
      create: { auditCycleId, auditorUserId, status: "Assigned" },
    });

    await createNotification({
      userId: auditorUserId,
      type: "AuditAssigned",
      message: "You have been assigned to an asset audit cycle.",
      linkPath: "/audits",
    });

    const updated = await prisma.auditCycle.findUnique({ where: { auditCycleId }, select: cycleSelect });
    return response.status(201).json({ auditCycle: updated });
  } catch (error) {
    if (error?.code === "P2003") return response.status(404).json({ message: "Auditor not found." });
    return next(error);
  }
}

async function verifyAsset(request, response, next) {
  const auditCycleId = toPositiveInteger(request.params.auditCycleId);
  const assetId = toPositiveInteger(request.body?.assetId);
  const verifiedStatus = request.body?.verifiedStatus;
  const errors = {};

  if (!auditCycleId) errors.auditCycleId = "A valid audit cycle ID is required.";
  if (!assetId) errors.assetId = "A valid asset ID is required.";
  if (!VERIFIED_STATUSES.has(verifiedStatus)) errors.verifiedStatus = "Status must be Verified, Missing, or Damaged.";
  if (Object.keys(errors).length > 0) return response.status(400).json({ message: "Invalid request data.", errors });

  try {
    const result = await runSerializableTransaction(async (transaction) => {
      const cycle = await transaction.auditCycle.findUnique({
        where: { auditCycleId },
        select: { status: true, scopeDepartmentId: true, scopeLocation: true },
      });
      if (!cycle) throw new CycleNotFoundError();
      if (cycle.status !== "Open") throw new CycleClosedError();

      const assignment = await transaction.auditAssignment.findUnique({
        where: { auditCycleId_auditorUserId: { auditCycleId, auditorUserId: request.user.userId } },
        select: { auditAssignmentId: true },
      });
      if (!assignment && request.user.role !== "Admin" && request.user.role !== "AssetManager") {
        throw new NotAssignedError();
      }

      const asset = await transaction.asset.findFirst({
        where: { assetId, ...scopeWhere(cycle) },
        select: { assetId: true },
      });
      if (!asset) throw new AssetNotInScopeError();

      return transaction.assetVerification.upsert({
        where: { auditCycleId_assetId: { auditCycleId, assetId } },
        update: { verifiedStatus, remarks: optionalTrimmedString(request.body?.remarks), auditorUserId: request.user.userId, verifiedAt: new Date() },
        create: { auditCycleId, assetId, auditorUserId: request.user.userId, verifiedStatus, remarks: optionalTrimmedString(request.body?.remarks) },
        select: { verificationId: true, assetId: true, verifiedStatus: true, remarks: true, verifiedAt: true },
      });
    });

    return response.status(200).json({ verification: result });
  } catch (error) {
    if (error instanceof CycleNotFoundError) return response.status(404).json({ message: "Audit cycle not found." });
    if (error instanceof CycleClosedError) return response.status(409).json({ message: "This audit cycle is closed." });
    if (error instanceof NotAssignedError) return response.status(403).json({ message: "You are not an assigned auditor for this cycle." });
    if (error instanceof AssetNotInScopeError) return response.status(409).json({ message: "This asset is not within the audit scope." });
    return next(error);
  }
}

async function closeAuditCycle(request, response, next) {
  const auditCycleId = toPositiveInteger(request.params.auditCycleId);
  if (!auditCycleId) {
    return response.status(400).json({ message: "Invalid request data.", errors: { auditCycleId: "ID must be a positive integer." } });
  }

  try {
    const result = await runSerializableTransaction(async (transaction) => {
      const cycle = await transaction.auditCycle.findUnique({ where: { auditCycleId }, select: { status: true, name: true } });
      if (!cycle) throw new CycleNotFoundError();
      if (cycle.status !== "Open") throw new CycleClosedError();

      const verifications = await transaction.assetVerification.findMany({
        where: { auditCycleId },
        select: { assetId: true, verifiedStatus: true, remarks: true, asset: { select: { assetTag: true, name: true } } },
      });

      const flagged = verifications.filter((v) => v.verifiedStatus !== "Verified");

      // Confirmed-missing assets become Lost.
      for (const verification of flagged) {
        if (verification.verifiedStatus === "Missing") {
          await transaction.asset.update({ where: { assetId: verification.assetId }, data: { status: "Lost" } });
        }
      }

      const summary = flagged.length === 0
        ? `Audit "${cycle.name}" closed with no discrepancies across ${verifications.length} verified assets.`
        : `Audit "${cycle.name}" closed with ${flagged.length} discrepancy(ies): ${flagged.map((v) => `${v.asset.assetTag} (${v.verifiedStatus})`).join(", ")}.`;

      await transaction.discrepancyReport.create({
        data: {
          auditCycleId,
          summary,
          status: flagged.length === 0 ? "Clean" : "Flagged",
          details: flagged.map((v) => ({ assetTag: v.asset.assetTag, name: v.asset.name, status: v.verifiedStatus, remarks: v.remarks })),
        },
      });

      await transaction.auditCycle.update({ where: { auditCycleId }, data: { status: "Closed" } });

      await logActivity({
        actorUserId: request.user.userId,
        actionType: "AuditCycleClosed",
        entityType: "AuditCycle",
        entityId: auditCycleId,
        details: summary,
      }, transaction);

      return { discrepancies: flagged.length, verified: verifications.length, summary };
    });

    return response.status(200).json(result);
  } catch (error) {
    if (error instanceof CycleNotFoundError) return response.status(404).json({ message: "Audit cycle not found." });
    if (error instanceof CycleClosedError) return response.status(409).json({ message: "This audit cycle is already closed." });
    return next(error);
  }
}

export { addAuditor, closeAuditCycle, createAuditCycle, getAuditCycle, listAuditCycles, verifyAsset };
