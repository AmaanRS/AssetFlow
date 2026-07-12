import { prisma } from "../database/prisma.js";
import { logActivity } from "../services/activity-log.js";
import {
  findUnexpectedFields,
  optionalTrimmedString,
  toPositiveInteger,
} from "../utils/validation.js";

const categorySelect = {
  categoryId: true,
  name: true,
  description: true,
  customFields: true,
  _count: { select: { assets: true } },
};

class DuplicateCategoryError extends Error {}
class CategoryNotFoundError extends Error {}

function serializeCategory(category) {
  const { _count, ...rest } = category;
  return { ...rest, assetCount: _count?.assets ?? 0 };
}

function validateCustomFields(customFields) {
  if (customFields === undefined || customFields === null) {
    return null;
  }

  if (!Array.isArray(customFields)) {
    return "customFields must be an array of field definitions.";
  }

  for (const field of customFields) {
    if (!field || typeof field !== "object" || typeof field.key !== "string") {
      return "Each custom field must be an object with a string key.";
    }
  }

  return null;
}

async function listCategories(_request, response, next) {
  try {
    const categories = await prisma.assetCategory.findMany({
      select: categorySelect,
      orderBy: { name: "asc" },
    });

    return response
      .status(200)
      .json({ categories: categories.map(serializeCategory) });
  } catch (error) {
    return next(error);
  }
}

async function createCategory(request, response, next) {
  const errors = {};
  const unexpectedFields = findUnexpectedFields(request.body, [
    "name",
    "description",
    "customFields",
  ]);
  const name = optionalTrimmedString(request.body?.name);
  const customFieldsError = validateCustomFields(request.body?.customFields);

  if (!name) {
    errors.name = "Category name is required.";
  }
  if (customFieldsError) {
    errors.customFields = customFieldsError;
  }
  if (unexpectedFields.length > 0) {
    errors.request = `Unexpected fields: ${unexpectedFields.join(", ")}.`;
  }

  if (Object.keys(errors).length > 0) {
    return response.status(400).json({ message: "Invalid request data.", errors });
  }

  try {
    const category = await prisma.$transaction(async (transaction) => {
      const existing = await transaction.assetCategory.findUnique({
        where: { name },
        select: { categoryId: true },
      });
      if (existing) {
        throw new DuplicateCategoryError();
      }

      const created = await transaction.assetCategory.create({
        data: {
          name,
          description: optionalTrimmedString(request.body?.description),
          customFields: request.body?.customFields ?? undefined,
        },
        select: categorySelect,
      });

      await logActivity(
        {
          actorUserId: request.user.userId,
          actionType: "CategoryCreated",
          entityType: "AssetCategory",
          entityId: created.categoryId,
          details: `Created category ${created.name}.`,
        },
        transaction,
      );

      return created;
    });

    return response.status(201).json({ category: serializeCategory(category) });
  } catch (error) {
    if (error instanceof DuplicateCategoryError || error?.code === "P2002") {
      return response
        .status(409)
        .json({ message: "A category with this name already exists." });
    }
    return next(error);
  }
}

async function updateCategory(request, response, next) {
  const categoryId = toPositiveInteger(request.params.categoryId);
  const errors = {};
  const unexpectedFields = findUnexpectedFields(request.body, [
    "name",
    "description",
    "customFields",
  ]);
  const customFieldsError = validateCustomFields(request.body?.customFields);

  if (!categoryId) {
    errors.categoryId = "Category ID must be a positive integer.";
  }
  if (
    request.body?.name !== undefined &&
    !optionalTrimmedString(request.body.name)
  ) {
    errors.name = "Category name must be a non-empty string.";
  }
  if (customFieldsError) {
    errors.customFields = customFieldsError;
  }
  if (unexpectedFields.length > 0) {
    errors.request = `Unexpected fields: ${unexpectedFields.join(", ")}.`;
  }

  if (Object.keys(errors).length > 0) {
    return response.status(400).json({ message: "Invalid request data.", errors });
  }

  try {
    const category = await prisma.$transaction(async (transaction) => {
      const existing = await transaction.assetCategory.findUnique({
        where: { categoryId },
        select: { categoryId: true },
      });
      if (!existing) {
        throw new CategoryNotFoundError();
      }

      const data = {};
      if (request.body.name !== undefined)
        data.name = optionalTrimmedString(request.body.name);
      if (request.body.description !== undefined)
        data.description = optionalTrimmedString(request.body.description);
      if (request.body.customFields !== undefined)
        data.customFields = request.body.customFields ?? undefined;

      const updated = await transaction.assetCategory.update({
        where: { categoryId },
        data,
        select: categorySelect,
      });

      await logActivity(
        {
          actorUserId: request.user.userId,
          actionType: "CategoryUpdated",
          entityType: "AssetCategory",
          entityId: categoryId,
          details: `Updated category ${updated.name}.`,
        },
        transaction,
      );

      return updated;
    });

    return response.status(200).json({ category: serializeCategory(category) });
  } catch (error) {
    if (error instanceof CategoryNotFoundError) {
      return response.status(404).json({ message: "Category not found." });
    }
    if (error?.code === "P2002") {
      return response
        .status(409)
        .json({ message: "A category with this name already exists." });
    }
    return next(error);
  }
}

export { createCategory, listCategories, updateCategory };
