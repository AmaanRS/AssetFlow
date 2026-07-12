import { prisma } from "../database/prisma.js";
import { logActivity } from "../services/activity-log.js";
import { findUnexpectedFields, toPositiveInteger } from "../utils/validation.js";

const publicUserSelect = {
  userId: true,
  name: true,
  email: true,
  role: true,
  departmentId: true,
  status: true,
  createdAt: true,
  department: { select: { departmentId: true, name: true } },
};

const promotableRoles = new Set(["DepartmentHead", "AssetManager"]);
const userStatuses = new Set(["Active", "Inactive"]);

class UserNotFoundError extends Error {}
class UserNotEmployeeError extends Error {}
class DepartmentNotFoundError extends Error {}

function validatePromotionRequest(request) {
  const errors = {};
  const unexpectedFields = findUnexpectedFields(request.body, ["role"]);
  const userId = toPositiveInteger(request.params.userId);

  if (!userId) {
    errors.userId = "User ID must be a positive integer.";
  }

  if (!promotableRoles.has(request.body?.role)) {
    errors.role = "Role must be DepartmentHead or AssetManager.";
  }

  if (unexpectedFields.length > 0) {
    errors.request = `Unexpected fields: ${unexpectedFields.join(", ")}.`;
  }

  return { errors, userId };
}

async function listUsers(request, response, next) {
  const where = {};

  if (typeof request.query.role === "string" && request.query.role.trim()) {
    where.role = request.query.role.trim();
  }

  const departmentId = toPositiveInteger(request.query.departmentId);
  if (departmentId) {
    where.departmentId = departmentId;
  }

  if (userStatuses.has(request.query.status)) {
    where.status = request.query.status;
  }

  try {
    const users = await prisma.user.findMany({
      where,
      select: publicUserSelect,
      orderBy: { userId: "asc" },
    });

    return response.status(200).json({ users });
  } catch (error) {
    return next(error);
  }
}

async function promoteUser(request, response, next) {
  const { errors, userId } = validatePromotionRequest(request);

  if (Object.keys(errors).length > 0) {
    return response.status(400).json({ message: "Invalid request data.", errors });
  }

  try {
    const user = await prisma.$transaction(async (transaction) => {
      const promotion = await transaction.user.updateMany({
        where: { userId, role: "Employee" },
        data: { role: request.body.role },
      });

      if (promotion.count !== 1) {
        const existingUser = await transaction.user.findUnique({
          where: { userId },
          select: { userId: true },
        });

        if (!existingUser) {
          throw new UserNotFoundError();
        }

        throw new UserNotEmployeeError();
      }

      await logActivity(
        {
          actorUserId: request.user.userId,
          actionType: "UserPromoted",
          entityType: "User",
          entityId: userId,
          details: `Promoted to ${request.body.role}.`,
        },
        transaction,
      );

      return transaction.user.findUnique({
        where: { userId },
        select: publicUserSelect,
      });
    });

    if (!user) {
      return response.status(404).json({ message: "User not found." });
    }

    return response.status(200).json({ user });
  } catch (error) {
    if (error instanceof UserNotFoundError) {
      return response.status(404).json({ message: "User not found." });
    }

    if (error instanceof UserNotEmployeeError) {
      return response
        .status(409)
        .json({ message: "Only Employee accounts can be promoted." });
    }

    return next(error);
  }
}

function validateUpdateUserRequest(request) {
  const errors = {};
  const unexpectedFields = findUnexpectedFields(request.body, [
    "departmentId",
    "status",
  ]);
  const userId = toPositiveInteger(request.params.userId);

  if (!userId) {
    errors.userId = "User ID must be a positive integer.";
  }

  if (
    request.body?.departmentId !== undefined &&
    request.body?.departmentId !== null &&
    !toPositiveInteger(request.body.departmentId)
  ) {
    errors.departmentId = "Department ID must be a positive integer or null.";
  }

  if (
    request.body?.status !== undefined &&
    !userStatuses.has(request.body.status)
  ) {
    errors.status = "Status must be Active or Inactive.";
  }

  if (unexpectedFields.length > 0) {
    errors.request = `Unexpected fields: ${unexpectedFields.join(", ")}.`;
  }

  return { errors, userId };
}

async function updateUser(request, response, next) {
  const { errors, userId } = validateUpdateUserRequest(request);

  if (Object.keys(errors).length > 0) {
    return response.status(400).json({ message: "Invalid request data.", errors });
  }

  const body = request.body;

  try {
    const user = await prisma.$transaction(async (transaction) => {
      const existing = await transaction.user.findUnique({
        where: { userId },
        select: { userId: true },
      });

      if (!existing) {
        throw new UserNotFoundError();
      }

      if (body.departmentId) {
        const department = await transaction.department.findUnique({
          where: { departmentId: body.departmentId },
          select: { departmentId: true },
        });
        if (!department) {
          throw new DepartmentNotFoundError();
        }
      }

      const data = {};
      if (body.departmentId !== undefined) data.departmentId = body.departmentId;
      if (body.status !== undefined) data.status = body.status;

      const updated = await transaction.user.update({
        where: { userId },
        data,
        select: publicUserSelect,
      });

      await logActivity(
        {
          actorUserId: request.user.userId,
          actionType: "UserUpdated",
          entityType: "User",
          entityId: userId,
          details: JSON.stringify(data),
        },
        transaction,
      );

      return updated;
    });

    return response.status(200).json({ user });
  } catch (error) {
    if (error instanceof UserNotFoundError) {
      return response.status(404).json({ message: "User not found." });
    }
    if (error instanceof DepartmentNotFoundError) {
      return response.status(404).json({ message: "Department not found." });
    }
    return next(error);
  }
}

export { listUsers, promoteUser, updateUser };
