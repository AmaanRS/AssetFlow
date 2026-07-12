import { prisma } from "../database/prisma.js";

const publicUserSelect = {
  userId: true,
  name: true,
  email: true,
  role: true,
  departmentId: true,
  createdAt: true,
};

const promotableRoles = new Set(["DepartmentHead", "AssetManager"]);

class UserNotFoundError extends Error {}

class UserNotEmployeeError extends Error {}

function validatePromotionRequest(request) {
  const errors = {};
  const unexpectedFields = Object.keys(request.body ?? {}).filter(
    (field) => field !== "role",
  );
  const userId = Number(request.params.userId);

  if (
    !/^[1-9]\d*$/.test(request.params.userId) ||
    !Number.isSafeInteger(userId) ||
    userId > 2147483647
  ) {
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

async function listUsers(_request, response, next) {
  try {
    const users = await prisma.user.findMany({
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
    return response.status(400).json({
      message: "Invalid request data.",
      errors,
    });
  }

  try {
    const user = await prisma.$transaction(async (transaction) => {
      const promotion = await transaction.user.updateMany({
        where: {
          userId,
          role: "Employee",
        },
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
      return response.status(409).json({
        message: "Only Employee accounts can be promoted.",
      });
    }

    return next(error);
  }
}

export { listUsers, promoteUser };
