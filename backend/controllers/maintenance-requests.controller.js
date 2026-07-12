import { prisma } from "../database/prisma.js";
import { logActivity } from "../services/activity-log.js";
import { createNotification } from "../services/notifications.js";
import { runSerializableTransaction } from "../utils/db.js";
import {
  findUnexpectedFields,
  isPositiveInteger,
  optionalTrimmedString,
  toPositiveInteger,
} from "../utils/validation.js";

const OPEN_MAINTENANCE_STATUSES = [
  "Pending",
  "Approved",
  "TechnicianAssigned",
  "InProgress",
];
const PRIORITIES = new Set(["Low", "Medium", "High", "Critical"]);

const maintenanceSelect = {
  maintenanceRequestId: true,
  assetId: true,
  raisedByUserId: true,
  approvedByUserId: true,
  technicianUserId: true,
  description: true,
  priority: true,
  photoUrl: true,
  resolutionNotes: true,
  status: true,
  raisedAt: true,
  approvedAt: true,
  workStartedAt: true,
  workCompletedAt: true,
  asset: { select: { assetId: true, assetTag: true, name: true, status: true } },
  raisedBy: { select: { userId: true, name: true } },
  approvedBy: { select: { userId: true, name: true } },
  technician: { select: { userId: true, name: true } },
};

class AssetNotFoundError extends Error {}
class OpenMaintenanceRequestError extends Error {}
class RequestNotFoundError extends Error {}
class InvalidTransitionError extends Error {}
class TechnicianNotFoundError extends Error {}

function validateMaintenanceRequest(body) {
  const errors = {};
  const unexpectedFields = findUnexpectedFields(body, [
    "assetId",
    "description",
    "priority",
    "photoUrl",
  ]);

  if (!isPositiveInteger(body?.assetId)) {
    errors.assetId = "Asset ID must be a positive integer.";
  }
  if (body?.priority !== undefined && !PRIORITIES.has(body.priority)) {
    errors.priority = "Priority must be Low, Medium, High, or Critical.";
  }
  if (unexpectedFields.length > 0) {
    errors.request = `Unexpected fields: ${unexpectedFields.join(", ")}.`;
  }

  return errors;
}

async function createMaintenanceRequest(request, response, next) {
  const errors = validateMaintenanceRequest(request.body);

  if (Object.keys(errors).length > 0) {
    return response.status(400).json({ message: "Invalid request data.", errors });
  }

  try {
    const maintenanceRequest = await runSerializableTransaction(async (transaction) => {
      const asset = await transaction.asset.findUnique({
        where: { assetId: request.body.assetId },
        select: { assetId: true, assetTag: true, name: true },
      });

      if (!asset) {
        throw new AssetNotFoundError();
      }

      const existingRequest = await transaction.maintenanceRequest.findFirst({
        where: { assetId: request.body.assetId, status: { in: OPEN_MAINTENANCE_STATUSES } },
        select: { maintenanceRequestId: true },
      });

      if (existingRequest) {
        throw new OpenMaintenanceRequestError();
      }

      const created = await transaction.maintenanceRequest.create({
        data: {
          assetId: request.body.assetId,
          raisedByUserId: request.user.userId,
          description: optionalTrimmedString(request.body.description),
          priority: request.body.priority ?? "Medium",
          photoUrl: optionalTrimmedString(request.body.photoUrl),
          status: "Pending",
        },
        select: maintenanceSelect,
      });

      await logActivity(
        {
          actorUserId: request.user.userId,
          actionType: "MaintenanceRaised",
          entityType: "Asset",
          entityId: asset.assetId,
          details: `Raised maintenance for ${asset.assetTag}.`,
        },
        transaction,
      );

      return created;
    });

    return response.status(201).json({ maintenanceRequest });
  } catch (error) {
    if (error instanceof AssetNotFoundError) {
      return response.status(404).json({ message: "Asset not found." });
    }
    if (error instanceof OpenMaintenanceRequestError) {
      return response.status(409).json({
        message: "An open maintenance request already exists for this asset.",
      });
    }
    return next(error);
  }
}

function buildScope(user, query) {
  const where = {};
  if (typeof query.status === "string" && query.status.trim()) {
    where.status = query.status.trim();
  }
  if (query.priority && PRIORITIES.has(query.priority)) {
    where.priority = query.priority;
  }
  const assetId = toPositiveInteger(query.assetId);
  if (assetId) where.assetId = assetId;

  if (user.role === "Employee") {
    where.OR = [{ raisedByUserId: user.userId }, { technicianUserId: user.userId }];
  } else if (user.role === "DepartmentHead") {
    where.OR = [
      { raisedByUserId: user.userId },
      { raisedBy: { departmentId: user.departmentId ?? -1 } },
    ];
  }
  return where;
}

async function listMaintenanceRequests(request, response, next) {
  const where = buildScope(request.user, request.query);
  try {
    const maintenanceRequests = await prisma.maintenanceRequest.findMany({
      where,
      select: maintenanceSelect,
      orderBy: { maintenanceRequestId: "desc" },
    });
    return response.status(200).json({ maintenanceRequests });
  } catch (error) {
    return next(error);
  }
}

/**
 * Generic status transition. `allowedFrom` lists valid source statuses.
 * `mutate(transaction, mr)` performs side effects (asset status, notifications).
 */
async function transition(request, response, next, { allowedFrom, actionType, buildData, sideEffects }) {
  const maintenanceRequestId = toPositiveInteger(request.params.maintenanceRequestId);
  if (!maintenanceRequestId) {
    return response.status(400).json({
      message: "Invalid request data.",
      errors: { maintenanceRequestId: "ID must be a positive integer." },
    });
  }

  try {
    const result = await runSerializableTransaction(async (transaction) => {
      const mr = await transaction.maintenanceRequest.findUnique({
        where: { maintenanceRequestId },
        select: maintenanceSelect,
      });
      if (!mr) throw new RequestNotFoundError();
      if (!allowedFrom.includes(mr.status)) throw new InvalidTransitionError();

      const data = await buildData(transaction, mr, request);
      const updated = await transaction.maintenanceRequest.update({
        where: { maintenanceRequestId },
        data,
        select: maintenanceSelect,
      });

      await logActivity(
        {
          actorUserId: request.user.userId,
          actionType,
          entityType: "Asset",
          entityId: mr.assetId,
          details: `${actionType} for ${mr.asset.assetTag}.`,
        },
        transaction,
      );

      if (sideEffects) await sideEffects(transaction, mr, updated, request);
      return updated;
    });

    return response.status(200).json({ maintenanceRequest: result });
  } catch (error) {
    if (error instanceof RequestNotFoundError) {
      return response.status(404).json({ message: "Maintenance request not found." });
    }
    if (error instanceof InvalidTransitionError) {
      return response.status(409).json({ message: "This maintenance request cannot be transitioned from its current state." });
    }
    if (error instanceof TechnicianNotFoundError) {
      return response.status(404).json({ message: "Technician not found." });
    }
    return next(error);
  }
}

function approveMaintenanceRequest(request, response, next) {
  return transition(request, response, next, {
    allowedFrom: ["Pending"],
    actionType: "MaintenanceApproved",
    buildData: () => ({
      status: "Approved",
      approvedByUserId: request.user.userId,
      approvedAt: new Date(),
    }),
    sideEffects: async (transaction, mr) => {
      await transaction.asset.update({
        where: { assetId: mr.assetId },
        data: { status: "UnderMaintenance" },
      });
      await createNotification(
        {
          userId: mr.raisedByUserId,
          type: "MaintenanceApproved",
          message: `Maintenance for ${mr.asset.assetTag} (${mr.asset.name}) was approved.`,
          linkPath: "/maintenance",
        },
        transaction,
      );
    },
  });
}

function rejectMaintenanceRequest(request, response, next) {
  return transition(request, response, next, {
    allowedFrom: ["Pending"],
    actionType: "MaintenanceRejected",
    buildData: () => ({
      status: "Rejected",
      approvedByUserId: request.user.userId,
      approvedAt: new Date(),
      resolutionNotes: optionalTrimmedString(request.body?.reason),
    }),
    sideEffects: async (transaction, mr) => {
      await createNotification(
        {
          userId: mr.raisedByUserId,
          type: "MaintenanceRejected",
          message: `Maintenance for ${mr.asset.assetTag} was rejected.`,
          linkPath: "/maintenance",
        },
        transaction,
      );
    },
  });
}

function assignTechnician(request, response, next) {
  const technicianUserId = toPositiveInteger(request.body?.technicianUserId);
  if (!technicianUserId) {
    return response.status(400).json({
      message: "Invalid request data.",
      errors: { technicianUserId: "Technician user ID must be a positive integer." },
    });
  }
  return transition(request, response, next, {
    allowedFrom: ["Approved", "TechnicianAssigned"],
    actionType: "MaintenanceTechnicianAssigned",
    buildData: async (transaction) => {
      const technician = await transaction.user.findUnique({
        where: { userId: technicianUserId },
        select: { userId: true },
      });
      if (!technician) throw new TechnicianNotFoundError();
      return { status: "TechnicianAssigned", technicianUserId };
    },
    sideEffects: async (transaction, mr) => {
      await createNotification(
        {
          userId: technicianUserId,
          type: "MaintenanceAssigned",
          message: `You were assigned maintenance for ${mr.asset.assetTag} (${mr.asset.name}).`,
          linkPath: "/maintenance",
        },
        transaction,
      );
    },
  });
}

function startMaintenance(request, response, next) {
  return transition(request, response, next, {
    allowedFrom: ["Approved", "TechnicianAssigned"],
    actionType: "MaintenanceStarted",
    buildData: () => ({ status: "InProgress", workStartedAt: new Date() }),
  });
}

function resolveMaintenance(request, response, next) {
  return transition(request, response, next, {
    allowedFrom: ["Approved", "TechnicianAssigned", "InProgress"],
    actionType: "MaintenanceResolved",
    buildData: () => ({
      status: "Resolved",
      workCompletedAt: new Date(),
      resolutionNotes: optionalTrimmedString(request.body?.resolutionNotes),
    }),
    sideEffects: async (transaction, mr) => {
      await transaction.asset.update({
        where: { assetId: mr.assetId },
        data: { status: "Available", currentHolderUserId: null, currentHolderDepartmentId: null },
      });
      await createNotification(
        {
          userId: mr.raisedByUserId,
          type: "MaintenanceResolved",
          message: `Maintenance for ${mr.asset.assetTag} (${mr.asset.name}) is resolved. The asset is available again.`,
          linkPath: "/maintenance",
        },
        transaction,
      );
    },
  });
}

export {
  approveMaintenanceRequest,
  assignTechnician,
  createMaintenanceRequest,
  listMaintenanceRequests,
  OPEN_MAINTENANCE_STATUSES,
  rejectMaintenanceRequest,
  resolveMaintenance,
  startMaintenance,
};
