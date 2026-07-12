import { prisma } from "../database/prisma.js";

const mysqlSignedIntMaximum = 2147483647;
const transactionRetryLimit = 3;

const publicAssetSelect = {
  assetId: true,
  assetTag: true,
  name: true,
  categoryId: true,
  status: true,
  isSharedResource: true,
  currentHolderUserId: true,
  currentHolderDepartmentId: true,
  registeredById: true,
  createdAt: true,
};

class AssetCategoryNotFoundError extends Error {}

class DuplicateAssetTagError extends Error {}

async function runSerializableTransaction(work) {
  for (let attempt = 1; attempt <= transactionRetryLimit; attempt += 1) {
    try {
      return await prisma.$transaction(work, {
        isolationLevel: "Serializable",
      });
    } catch (error) {
      if (error?.code !== "P2034" || attempt === transactionRetryLimit) {
        throw error;
      }
    }
  }

  throw new Error("Unable to complete the transaction.");
}

function validateCreateAssetRequest(body) {
  const errors = {};
  const allowedFields = [
    "assetTag",
    "name",
    "categoryId",
    "isSharedResource",
  ];
  const unexpectedFields = Object.keys(body ?? {}).filter(
    (field) => !allowedFields.includes(field),
  );

  if (typeof body?.assetTag !== "string" || !body.assetTag.trim()) {
    errors.assetTag = "Asset tag is required.";
  }

  if (typeof body?.name !== "string" || !body.name.trim()) {
    errors.name = "Name is required.";
  }

  if (
    !Number.isInteger(body?.categoryId) ||
    body.categoryId <= 0 ||
    body.categoryId > mysqlSignedIntMaximum
  ) {
    errors.categoryId = "Category ID must be a positive integer.";
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
    return response.status(400).json({
      message: "Invalid request data.",
      errors,
    });
  }

  const assetTag = request.body.assetTag.trim();

  try {
    const asset = await runSerializableTransaction(async (transaction) => {
      const category = await transaction.assetCategory.findUnique({
        where: { categoryId: request.body.categoryId },
        select: { categoryId: true },
      });

      if (!category) {
        throw new AssetCategoryNotFoundError();
      }

      const existingAsset = await transaction.asset.findFirst({
        where: { assetTag },
        select: { assetId: true },
      });

      if (existingAsset) {
        throw new DuplicateAssetTagError();
      }

      return transaction.asset.create({
        data: {
          assetTag,
          name: request.body.name.trim(),
          categoryId: request.body.categoryId,
          status: "Available",
          isSharedResource: request.body.isSharedResource ?? false,
          currentHolderUserId: null,
          currentHolderDepartmentId: null,
          registeredById: request.user.userId,
        },
        select: publicAssetSelect,
      });
    });

    return response.status(201).json({ asset });
  } catch (error) {
    if (error instanceof AssetCategoryNotFoundError) {
      return response.status(404).json({
        message: "Asset category not found.",
      });
    }

    if (error instanceof DuplicateAssetTagError || error?.code === "P2002") {
      return response.status(409).json({
        message: "An asset with this asset tag already exists.",
      });
    }

    if (error?.code === "P2003") {
      return response.status(404).json({
        message: "Asset category not found.",
      });
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

export { createAsset };
