import { prisma } from "../database/prisma.js";
import { logActivity } from "../services/activity-log.js";
import {
  mysqlSignedIntMaximum,
  runSerializableTransaction,
} from "../utils/db.js";
import {
  findUnexpectedFields,
  isPositiveInteger,
  optionalTrimmedString,
  parseDate,
  toPositiveInteger,
} from "../utils/validation.js";

const ASSET_STATUSES = [
  "Available",
  "Allocated",
  "Reserved",
  "UnderMaintenance",
  "Lost",
  "Retired",
  "Disposed",
];

// Statuses an Asset Manager can set manually (lifecycle states not owned by the
// allocation/maintenance workflows).
const MANUAL_STATUS_TRANSITIONS = ["Available", "Lost", "Retired", "Disposed"];

const defaultPageSize = 20;
const maxPageSize = 100;

const assetListSelect = {
  assetId: true,
  assetTag: true,
  name: true,
  serialNumber: true,
  categoryId: true,
  status: true,
  condition: true,
  location: true,
  acquisitionDate: true,
  acquisitionCost: true,
  photoUrl: true,
  customValues: true,
  isSharedResource: true,
  currentHolderUserId: true,
  currentHolderDepartmentId: true,
  registeredById: true,
  createdAt: true,
  category: { select: { categoryId: true, name: true } },
  currentHolderUser: { select: { userId: true, name: true, email: true } },
  currentHolderDepartment: { select: { departmentId: true, name: true } },
  registeredBy: { select: { userId: true, name: true } },
};

class AssetCategoryNotFoundError extends Error {}
class DuplicateAssetTagError extends Error {}
class AssetNotFoundError extends Error {}
class InvalidStatusTransitionError extends Error {}

function serializeAsset(asset) {
  if (!asset) {
    return asset;
  }

  return {
    ...asset,
    acquisitionCost:
      asset.acquisitionCost == null ? null : Number(asset.acquisitionCost),
  };
}

async function generateAssetTag(transaction) {
  const rows = await transaction.asset.findMany({
    where: { assetTag: { startsWith: "AF-" } },
    select: { assetTag: true },
  });

  const maxNumber = rows.reduce((max, row) => {
    const parsed = Number.parseInt(row.assetTag.slice(3), 10);
    return Number.isFinite(parsed) && parsed > max ? parsed : max;
  }, 0);

  return `AF-${String(maxNumber + 1).padStart(4, "0")}`;
}

function validateCreateAssetRequest(body) {
  const errors = {};
  const allowedFields = [
    "assetTag",
    "name",
    "serialNumber",
    "categoryId",
    "condition",
    "location",
    "acquisitionDate",
    "acquisitionCost",
    "photoUrl",
    "isSharedResource",
    "customValues",
  ];
  const unexpectedFields = findUnexpectedFields(body, allowedFields);

  if (typeof body?.name !== "string" || !body.name.trim()) {
    errors.name = "Name is required.";
  }

  if (!isPositiveInteger(body?.categoryId)) {
    errors.categoryId = "Category ID must be a positive integer.";
  }

  if (
    body?.assetTag !== undefined &&
    body?.assetTag !== null &&
    (typeof body.assetTag !== "string" || !body.assetTag.trim())
  ) {
    errors.assetTag = "Asset tag must be a non-empty string when provided.";
  }

  if (
    body?.acquisitionCost !== undefined &&
    body?.acquisitionCost !== null &&
    (typeof body.acquisitionCost !== "number" ||
      Number.isNaN(body.acquisitionCost) ||
      body.acquisitionCost < 0)
  ) {
    errors.acquisitionCost = "Acquisition cost must be a non-negative number.";
  }

  if (
    body?.acquisitionDate !== undefined &&
    body?.acquisitionDate !== null &&
    !parseDate(body.acquisitionDate)
  ) {
    errors.acquisitionDate = "Acquisition date must be a valid date.";
  }

  if (
    body?.isSharedResource !== undefined &&
    typeof body.isSharedResource !== "boolean"
  ) {
    errors.isSharedResource = "isSharedResource must be a boolean.";
  }

  if (unexpectedFields.length > 0) {
    errors.request = `Unexpected fields: ${unexpectedFields.join(", ")}.`;
  }

  return errors;
}

async function createAsset(request, response, next) {
  const errors = validateCreateAssetRequest(request.body);

  if (Object.keys(errors).length > 0) {
    return response.status(400).json({ message: "Invalid request data.", errors });
  }

  const body = request.body;
  const providedTag = optionalTrimmedString(body.assetTag);

  try {
    const asset = await runSerializableTransaction(async (transaction) => {
      const category = await transaction.assetCategory.findUnique({
        where: { categoryId: body.categoryId },
        select: { categoryId: true },
      });

      if (!category) {
        throw new AssetCategoryNotFoundError();
      }

      const assetTag = providedTag ?? (await generateAssetTag(transaction));

      const existingAsset = await transaction.asset.findFirst({
        where: { assetTag },
        select: { assetId: true },
      });

      if (existingAsset) {
        throw new DuplicateAssetTagError();
      }

      const created = await transaction.asset.create({
        data: {
          assetTag,
          name: body.name.trim(),
          serialNumber: optionalTrimmedString(body.serialNumber),
          categoryId: body.categoryId,
          status: "Available",
          condition: optionalTrimmedString(body.condition),
          location: optionalTrimmedString(body.location),
          acquisitionDate: body.acquisitionDate
            ? parseDate(body.acquisitionDate)
            : null,
          acquisitionCost:
            body.acquisitionCost === undefined || body.acquisitionCost === null
              ? null
              : body.acquisitionCost,
          photoUrl: optionalTrimmedString(body.photoUrl),
          isSharedResource: body.isSharedResource ?? false,
          customValues:
            body.customValues && typeof body.customValues === "object"
              ? body.customValues
              : undefined,
          currentHolderUserId: null,
          currentHolderDepartmentId: null,
          registeredById: request.user.userId,
        },
        select: assetListSelect,
      });

      await logActivity(
        {
          actorUserId: request.user.userId,
          actionType: "AssetRegistered",
          entityType: "Asset",
          entityId: created.assetId,
          details: `Registered ${created.assetTag} (${created.name}).`,
        },
        transaction,
      );

      return created;
    });

    return response.status(201).json({ asset: serializeAsset(asset) });
  } catch (error) {
    if (error instanceof AssetCategoryNotFoundError || error?.code === "P2003") {
      return response.status(404).json({ message: "Asset category not found." });
    }

    if (error instanceof DuplicateAssetTagError || error?.code === "P2002") {
      return response
        .status(409)
        .json({ message: "An asset with this asset tag already exists." });
    }

    if (error?.code === "P2000") {
      return response.status(400).json({
        message: "Invalid request data.",
        errors: {
          request:
            "One or more values exceed the database-supported field length.",
        },
      });
    }

    return next(error);
  }
}

function buildAssetFilters(query) {
  const where = {};
  const search = optionalTrimmedString(query.search);

  if (search) {
    where.OR = [
      { name: { contains: search } },
      { assetTag: { contains: search } },
      { serialNumber: { contains: search } },
    ];
  }

  const categoryId = toPositiveInteger(query.categoryId);
  if (categoryId) {
    where.categoryId = categoryId;
  }

  if (typeof query.status === "string" && ASSET_STATUSES.includes(query.status)) {
    where.status = query.status;
  }

  const departmentId = toPositiveInteger(query.departmentId);
  if (departmentId) {
    where.currentHolderDepartmentId = departmentId;
  }

  const holderUserId = toPositiveInteger(query.holderUserId);
  if (holderUserId) {
    where.currentHolderUserId = holderUserId;
  }

  const location = optionalTrimmedString(query.location);
  if (location) {
    where.location = { contains: location };
  }

  if (query.isSharedResource === "true") {
    where.isSharedResource = true;
  } else if (query.isSharedResource === "false") {
    where.isSharedResource = false;
  }

  return where;
}

async function listAssets(request, response, next) {
  const where = buildAssetFilters(request.query);
  const page = toPositiveInteger(request.query.page) ?? 1;
  const requestedSize = toPositiveInteger(request.query.pageSize) ?? defaultPageSize;
  const pageSize = Math.min(requestedSize, maxPageSize);

  try {
    const [total, assets] = await prisma.$transaction([
      prisma.asset.count({ where }),
      prisma.asset.findMany({
        where,
        select: assetListSelect,
        orderBy: { assetId: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return response.status(200).json({
      assets: assets.map(serializeAsset),
      total,
      page,
      pageSize,
    });
  } catch (error) {
    return next(error);
  }
}

async function getAsset(request, response, next) {
  const assetId = toPositiveInteger(request.params.assetId);

  if (!assetId) {
    return response
      .status(400)
      .json({ message: "Invalid request data.", errors: { assetId: "Asset ID must be a positive integer." } });
  }

  try {
    const asset = await prisma.asset.findUnique({
      where: { assetId },
      select: assetListSelect,
    });

    if (!asset) {
      return response.status(404).json({ message: "Asset not found." });
    }

    return response.status(200).json({ asset: serializeAsset(asset) });
  } catch (error) {
    return next(error);
  }
}

async function getAssetHistory(request, response, next) {
  const assetId = toPositiveInteger(request.params.assetId);

  if (!assetId) {
    return response
      .status(400)
      .json({ message: "Invalid request data.", errors: { assetId: "Asset ID must be a positive integer." } });
  }

  try {
    const asset = await prisma.asset.findUnique({
      where: { assetId },
      select: { assetId: true },
    });

    if (!asset) {
      return response.status(404).json({ message: "Asset not found." });
    }

    const [allocations, maintenanceRequests, transfers] = await prisma.$transaction([
      prisma.assetAllocation.findMany({
        where: { assetId },
        orderBy: { allocationId: "desc" },
        select: {
          allocationId: true,
          status: true,
          allocatedAt: true,
          expectedReturnDate: true,
          returnedAt: true,
          checkInNotes: true,
          returnCondition: true,
          allocatedToUser: { select: { userId: true, name: true } },
          allocatedToDepartment: { select: { departmentId: true, name: true } },
          allocatedBy: { select: { userId: true, name: true } },
        },
      }),
      prisma.maintenanceRequest.findMany({
        where: { assetId },
        orderBy: { maintenanceRequestId: "desc" },
        select: {
          maintenanceRequestId: true,
          status: true,
          priority: true,
          description: true,
          raisedAt: true,
          approvedAt: true,
          workStartedAt: true,
          workCompletedAt: true,
          resolutionNotes: true,
          raisedBy: { select: { userId: true, name: true } },
          approvedBy: { select: { userId: true, name: true } },
          technician: { select: { userId: true, name: true } },
        },
      }),
      prisma.transferRequest.findMany({
        where: { assetId },
        orderBy: { transferRequestId: "desc" },
        select: {
          transferRequestId: true,
          status: true,
          requestedAt: true,
          approvedAt: true,
          fromUser: { select: { userId: true, name: true } },
          fromDepartment: { select: { departmentId: true, name: true } },
          toUser: { select: { userId: true, name: true } },
          toDepartment: { select: { departmentId: true, name: true } },
          requestedBy: { select: { userId: true, name: true } },
          approvedBy: { select: { userId: true, name: true } },
        },
      }),
    ]);

    return response.status(200).json({ allocations, maintenanceRequests, transfers });
  } catch (error) {
    return next(error);
  }
}

function validateUpdateAssetRequest(body) {
  const errors = {};
  const allowedFields = [
    "name",
    "serialNumber",
    "categoryId",
    "condition",
    "location",
    "acquisitionDate",
    "acquisitionCost",
    "photoUrl",
    "isSharedResource",
    "customValues",
    "status",
  ];
  const unexpectedFields = findUnexpectedFields(body, allowedFields);

  if (
    body?.name !== undefined &&
    (typeof body.name !== "string" || !body.name.trim())
  ) {
    errors.name = "Name must be a non-empty string.";
  }

  if (body?.categoryId !== undefined && !isPositiveInteger(body.categoryId)) {
    errors.categoryId = "Category ID must be a positive integer.";
  }

  if (
    body?.acquisitionCost !== undefined &&
    body?.acquisitionCost !== null &&
    (typeof body.acquisitionCost !== "number" ||
      Number.isNaN(body.acquisitionCost) ||
      body.acquisitionCost < 0)
  ) {
    errors.acquisitionCost = "Acquisition cost must be a non-negative number.";
  }

  if (
    body?.acquisitionDate !== undefined &&
    body?.acquisitionDate !== null &&
    !parseDate(body.acquisitionDate)
  ) {
    errors.acquisitionDate = "Acquisition date must be a valid date.";
  }

  if (
    body?.isSharedResource !== undefined &&
    typeof body.isSharedResource !== "boolean"
  ) {
    errors.isSharedResource = "isSharedResource must be a boolean.";
  }

  if (
    body?.status !== undefined &&
    !MANUAL_STATUS_TRANSITIONS.includes(body.status)
  ) {
    errors.status = `Status must be one of: ${MANUAL_STATUS_TRANSITIONS.join(", ")}.`;
  }

  if (unexpectedFields.length > 0) {
    errors.request = `Unexpected fields: ${unexpectedFields.join(", ")}.`;
  }

  return errors;
}

async function updateAsset(request, response, next) {
  const assetId = toPositiveInteger(request.params.assetId);

  if (!assetId) {
    return response
      .status(400)
      .json({ message: "Invalid request data.", errors: { assetId: "Asset ID must be a positive integer." } });
  }

  const errors = validateUpdateAssetRequest(request.body);

  if (Object.keys(errors).length > 0) {
    return response.status(400).json({ message: "Invalid request data.", errors });
  }

  const body = request.body;

  try {
    const asset = await runSerializableTransaction(async (transaction) => {
      const existing = await transaction.asset.findUnique({
        where: { assetId },
        select: { assetId: true, status: true },
      });

      if (!existing) {
        throw new AssetNotFoundError();
      }

      // Guard status changes: workflow-owned states cannot be overridden here,
      // and an actively held asset cannot be retired/disposed/lost.
      if (body.status !== undefined) {
        const workflowOwned = ["Allocated", "Reserved", "UnderMaintenance"];
        if (
          workflowOwned.includes(existing.status) &&
          body.status !== existing.status
        ) {
          throw new InvalidStatusTransitionError();
        }
      }

      if (body.categoryId !== undefined) {
        const category = await transaction.assetCategory.findUnique({
          where: { categoryId: body.categoryId },
          select: { categoryId: true },
        });
        if (!category) {
          throw new AssetCategoryNotFoundError();
        }
      }

      const data = {};
      if (body.name !== undefined) data.name = body.name.trim();
      if (body.serialNumber !== undefined)
        data.serialNumber = optionalTrimmedString(body.serialNumber);
      if (body.categoryId !== undefined) data.categoryId = body.categoryId;
      if (body.condition !== undefined)
        data.condition = optionalTrimmedString(body.condition);
      if (body.location !== undefined)
        data.location = optionalTrimmedString(body.location);
      if (body.acquisitionDate !== undefined)
        data.acquisitionDate = body.acquisitionDate
          ? parseDate(body.acquisitionDate)
          : null;
      if (body.acquisitionCost !== undefined)
        data.acquisitionCost = body.acquisitionCost;
      if (body.photoUrl !== undefined)
        data.photoUrl = optionalTrimmedString(body.photoUrl);
      if (body.isSharedResource !== undefined)
        data.isSharedResource = body.isSharedResource;
      if (body.customValues !== undefined)
        data.customValues =
          body.customValues && typeof body.customValues === "object"
            ? body.customValues
            : undefined;
      if (body.status !== undefined) data.status = body.status;

      const updated = await transaction.asset.update({
        where: { assetId },
        data,
        select: assetListSelect,
      });

      await logActivity(
        {
          actorUserId: request.user.userId,
          actionType: "AssetUpdated",
          entityType: "Asset",
          entityId: assetId,
          details: `Updated ${updated.assetTag}.`,
        },
        transaction,
      );

      return updated;
    });

    return response.status(200).json({ asset: serializeAsset(asset) });
  } catch (error) {
    if (error instanceof AssetNotFoundError) {
      return response.status(404).json({ message: "Asset not found." });
    }
    if (error instanceof AssetCategoryNotFoundError) {
      return response.status(404).json({ message: "Asset category not found." });
    }
    if (error instanceof InvalidStatusTransitionError) {
      return response.status(409).json({
        message:
          "This asset is currently in a workflow (allocated, reserved, or under maintenance) and its status cannot be changed manually.",
      });
    }
    return next(error);
  }
}

export {
  ASSET_STATUSES,
  createAsset,
  getAsset,
  getAssetHistory,
  listAssets,
  updateAsset,
};
