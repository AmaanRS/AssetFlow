import { prisma } from "../database/prisma.js";
import { logActivity } from "../services/activity-log.js";
import {
  findUnexpectedFields,
  optionalTrimmedString,
  toPositiveInteger,
} from "../utils/validation.js";

const departmentSelect = {
  departmentId: true,
  name: true,
  description: true,
  headUserId: true,
  parentDepartmentId: true,
  status: true,
  createdAt: true,
  head: { select: { userId: true, name: true, email: true } },
  parent: { select: { departmentId: true, name: true } },
  _count: { select: { members: true, heldAssets: true } },
};

const departmentStatuses = new Set(["Active", "Inactive"]);

class DuplicateDepartmentError extends Error {}
class DepartmentNotFoundError extends Error {}
class HeadUserNotFoundError extends Error {}
class ParentDepartmentNotFoundError extends Error {}
class InvalidParentError extends Error {}

function serializeDepartment(department) {
  const { _count, ...rest } = department;
  return {
    ...rest,
    memberCount: _count?.members ?? 0,
    assetCount: _count?.heldAssets ?? 0,
  };
}

async function listDepartments(_request, response, next) {
  try {
    const departments = await prisma.department.findMany({
      select: departmentSelect,
      orderBy: { name: "asc" },
    });

    return response
      .status(200)
      .json({ departments: departments.map(serializeDepartment) });
  } catch (error) {
    return next(error);
  }
}

async function createDepartment(request, response, next) {
  const errors = {};
  const unexpectedFields = findUnexpectedFields(request.body, [
    "name",
    "description",
    "headUserId",
    "parentDepartmentId",
    "status",
  ]);
  const name = optionalTrimmedString(request.body?.name);
  const headUserId =
    request.body?.headUserId == null
      ? null
      : toPositiveInteger(request.body.headUserId);
  const parentDepartmentId =
    request.body?.parentDepartmentId == null
      ? null
      : toPositiveInteger(request.body.parentDepartmentId);

  if (!name) {
    errors.name = "Department name is required.";
  }
  if (request.body?.headUserId != null && !headUserId) {
    errors.headUserId = "Head user ID must be a positive integer.";
  }
  if (request.body?.parentDepartmentId != null && !parentDepartmentId) {
    errors.parentDepartmentId = "Parent department ID must be a positive integer.";
  }
  if (
    request.body?.status !== undefined &&
    !departmentStatuses.has(request.body.status)
  ) {
    errors.status = "Status must be Active or Inactive.";
  }
  if (unexpectedFields.length > 0) {
    errors.request = `Unexpected fields: ${unexpectedFields.join(", ")}.`;
  }

  if (Object.keys(errors).length > 0) {
    return response.status(400).json({ message: "Invalid request data.", errors });
  }

  try {
    const department = await prisma.$transaction(async (transaction) => {
      const existing = await transaction.department.findUnique({
        where: { name },
        select: { departmentId: true },
      });
      if (existing) {
        throw new DuplicateDepartmentError();
      }

      if (headUserId) {
        const head = await transaction.user.findUnique({
          where: { userId: headUserId },
          select: { userId: true },
        });
        if (!head) {
          throw new HeadUserNotFoundError();
        }
      }

      if (parentDepartmentId) {
        const parent = await transaction.department.findUnique({
          where: { departmentId: parentDepartmentId },
          select: { departmentId: true },
        });
        if (!parent) {
          throw new ParentDepartmentNotFoundError();
        }
      }

      const created = await transaction.department.create({
        data: {
          name,
          description: optionalTrimmedString(request.body?.description),
          headUserId,
          parentDepartmentId,
          status: request.body?.status ?? "Active",
        },
        select: departmentSelect,
      });

      await logActivity(
        {
          actorUserId: request.user.userId,
          actionType: "DepartmentCreated",
          entityType: "Department",
          entityId: created.departmentId,
          details: `Created department ${created.name}.`,
        },
        transaction,
      );

      return created;
    });

    return response
      .status(201)
      .json({ department: serializeDepartment(department) });
  } catch (error) {
    if (error instanceof DuplicateDepartmentError || error?.code === "P2002") {
      return response
        .status(409)
        .json({ message: "A department with this name already exists." });
    }
    if (error instanceof HeadUserNotFoundError) {
      return response.status(404).json({ message: "Head user not found." });
    }
    if (error instanceof ParentDepartmentNotFoundError) {
      return response.status(404).json({ message: "Parent department not found." });
    }
    return next(error);
  }
}

async function updateDepartment(request, response, next) {
  const departmentId = toPositiveInteger(request.params.departmentId);
  const errors = {};
  const unexpectedFields = findUnexpectedFields(request.body, [
    "name",
    "description",
    "headUserId",
    "parentDepartmentId",
    "status",
  ]);

  if (!departmentId) {
    errors.departmentId = "Department ID must be a positive integer.";
  }
  if (
    request.body?.name !== undefined &&
    !optionalTrimmedString(request.body.name)
  ) {
    errors.name = "Department name must be a non-empty string.";
  }
  if (
    request.body?.status !== undefined &&
    !departmentStatuses.has(request.body.status)
  ) {
    errors.status = "Status must be Active or Inactive.";
  }

  const headUserId =
    request.body?.headUserId == null
      ? null
      : toPositiveInteger(request.body.headUserId);
  const parentDepartmentId =
    request.body?.parentDepartmentId == null
      ? null
      : toPositiveInteger(request.body.parentDepartmentId);

  if (request.body?.headUserId != null && !headUserId) {
    errors.headUserId = "Head user ID must be a positive integer.";
  }
  if (request.body?.parentDepartmentId != null && !parentDepartmentId) {
    errors.parentDepartmentId = "Parent department ID must be a positive integer.";
  }
  if (unexpectedFields.length > 0) {
    errors.request = `Unexpected fields: ${unexpectedFields.join(", ")}.`;
  }

  if (Object.keys(errors).length > 0) {
    return response.status(400).json({ message: "Invalid request data.", errors });
  }

  try {
    const department = await prisma.$transaction(async (transaction) => {
      const existing = await transaction.department.findUnique({
        where: { departmentId },
        select: { departmentId: true },
      });
      if (!existing) {
        throw new DepartmentNotFoundError();
      }

      if (headUserId) {
        const head = await transaction.user.findUnique({
          where: { userId: headUserId },
          select: { userId: true },
        });
        if (!head) {
          throw new HeadUserNotFoundError();
        }
      }

      if (parentDepartmentId) {
        if (parentDepartmentId === departmentId) {
          throw new InvalidParentError();
        }
        const parent = await transaction.department.findUnique({
          where: { departmentId: parentDepartmentId },
          select: { departmentId: true },
        });
        if (!parent) {
          throw new ParentDepartmentNotFoundError();
        }
      }

      const data = {};
      if (request.body.name !== undefined)
        data.name = optionalTrimmedString(request.body.name);
      if (request.body.description !== undefined)
        data.description = optionalTrimmedString(request.body.description);
      if (request.body.headUserId !== undefined) data.headUserId = headUserId;
      if (request.body.parentDepartmentId !== undefined)
        data.parentDepartmentId = parentDepartmentId;
      if (request.body.status !== undefined) data.status = request.body.status;

      const updated = await transaction.department.update({
        where: { departmentId },
        data,
        select: departmentSelect,
      });

      await logActivity(
        {
          actorUserId: request.user.userId,
          actionType: "DepartmentUpdated",
          entityType: "Department",
          entityId: departmentId,
          details: `Updated department ${updated.name}.`,
        },
        transaction,
      );

      return updated;
    });

    return response
      .status(200)
      .json({ department: serializeDepartment(department) });
  } catch (error) {
    if (error instanceof DepartmentNotFoundError) {
      return response.status(404).json({ message: "Department not found." });
    }
    if (error instanceof HeadUserNotFoundError) {
      return response.status(404).json({ message: "Head user not found." });
    }
    if (error instanceof ParentDepartmentNotFoundError) {
      return response.status(404).json({ message: "Parent department not found." });
    }
    if (error instanceof InvalidParentError) {
      return response
        .status(409)
        .json({ message: "A department cannot be its own parent." });
    }
    if (error?.code === "P2002") {
      return response
        .status(409)
        .json({ message: "A department with this name already exists." });
    }
    return next(error);
  }
}

export { createDepartment, listDepartments, updateDepartment };
