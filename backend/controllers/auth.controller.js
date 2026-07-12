import validator from "validator";
import { config } from "../config/config.js";
import { prisma } from "../database/prisma.js";
import { sendPasswordResetEmail } from "../services/email.js";
import { createAccessToken, verifyAccessToken } from "../utils/jwt.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import {
  generatePasswordResetToken,
  hashPasswordResetToken,
} from "../utils/reset-token.js";

const publicUserSelect = {
  userId: true,
  name: true,
  email: true,
  role: true,
  departmentId: true,
  createdAt: true,
};

const authenticationUserSelect = {
  ...publicUserSelect,
  passwordHash: true,
  sessionVersion: true,
};

const sessionUserSelect = {
  ...publicUserSelect,
  sessionVersion: true,
};

const forgotPasswordResponse = {
  message:
    "If an account exists for that email, password reset instructions have been sent.",
};

class InvalidPasswordResetTokenError extends Error {}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function validatePassword(password) {
  if (typeof password !== "string" || password.length < 8) {
    return "Password must contain at least 8 characters.";
  }

  if (Buffer.byteLength(password, "utf8") > 72) {
    return "Password must contain at most 72";
  }

  return null;
}

function validateCredentials(body, includeName = false) {
  const errors = {};
  const passwordError = validatePassword(body?.password);
  const allowedFields = includeName
    ? ["name", "email", "password"]
    : ["email", "password"];
  const unexpectedFields = Object.keys(body ?? {}).filter(
    (field) => !allowedFields.includes(field),
  );

  if (unexpectedFields.length > 0) {
    errors.request = `Unexpected fields: ${unexpectedFields.join(", ")}.`;
  }

  if (typeof body?.email !== "string" || !validator.isEmail(body.email.trim())) {
    errors.email = "A valid email is required.";
  }

  if (passwordError) {
    errors.password = passwordError;
  }

  if (
    includeName &&
    (typeof body?.name !== "string" || body.name.trim().length === 0)
  ) {
    errors.name = "Name is required.";
  }

  return errors;
}

function sendValidationError(response, errors) {
  return response.status(400).json({
    message: "Invalid request data.",
    errors,
  });
}

function toPublicUser(user) {
  const {
    passwordHash: _passwordHash,
    sessionVersion: _sessionVersion,
    ...publicUser
  } = user;

  return publicUser;
}

function createAuthenticationResponse(user) {
  return {
    token: createAccessToken(user),
    user: toPublicUser(user),
  };
}

function sendInvalidResetToken(response) {
  return response.status(400).json({
    message: "The password reset token is invalid or has expired.",
  });
}

async function signup(request, response, next) {
  const errors = validateCredentials(request.body, true);

  if (Object.keys(errors).length > 0) {
    return sendValidationError(response, errors);
  }

  const email = normalizeEmail(request.body.email);

  try {
    const existingUser = await prisma.user.findFirst({
      where: { email },
      select: { userId: true },
    });

    if (existingUser) {
      return response.status(409).json({
        message: "An account with this email already exists.",
      });
    }

    const passwordHash = await hashPassword(request.body.password);
    const user = await prisma.user.create({
      data: {
        name: request.body.name.trim(),
        email,
        passwordHash,
        role: "Employee",
      },
      select: authenticationUserSelect,
    });

    return response.status(201).json(createAuthenticationResponse(user));
  } catch (error) {
    if (error?.code === "P2002") {
      return response.status(409).json({
        message: "An account with this email already exists.",
      });
    }

    return next(error);
  }
}

async function login(request, response, next) {
  const errors = validateCredentials(request.body);

  if (Object.keys(errors).length > 0) {
    return sendValidationError(response, errors);
  }

  const email = normalizeEmail(request.body.email);

  try {
    const user = await prisma.user.findFirst({
      where: { email },
      select: authenticationUserSelect,
    });
    const passwordMatches = user
      ? await verifyPassword(request.body.password, user.passwordHash)
      : false;

    if (!passwordMatches) {
      return response.status(401).json({
        message: "Invalid email or password.",
      });
    }

    return response.status(200).json(createAuthenticationResponse(user));
  } catch (error) {
    return next(error);
  }
}

async function forgotPassword(request, response) {
  const unexpectedFields = Object.keys(request.body ?? {}).filter(
    (field) => field !== "email",
  );

  if (unexpectedFields.length > 0) {
    return sendValidationError(response, {
      request: `Unexpected fields: ${unexpectedFields.join(", ")}.`,
    });
  }

  if (
    typeof request.body?.email !== "string" ||
    !validator.isEmail(request.body.email.trim())
  ) {
    return sendValidationError(response, {
      email: "A valid email is required.",
    });
  }

  const email = normalizeEmail(request.body.email);

  try {
    const user = await prisma.user.findFirst({
      where: { email },
      select: { userId: true, email: true, name: true },
    });

    if (user) {
      const token = generatePasswordResetToken();
      const tokenHash = hashPasswordResetToken(token);
      const expiresAt = new Date(
        Date.now() +
          config.get("PASSWORD_RESET_TOKEN_TTL_MINUTES") * 60 * 1000,
      );

      await prisma.$transaction([
        prisma.passwordResetToken.deleteMany({
          where: { userId: user.userId, usedAt: null },
        }),
        prisma.passwordResetToken.create({
          data: {
            userId: user.userId,
            tokenHash,
            expiresAt,
          },
        }),
      ]);

      try {
        const delivered = await sendPasswordResetEmail({
          email: user.email,
          name: user.name,
          token,
        });

        if (!delivered) {
          await prisma.passwordResetToken.deleteMany({
            where: { userId: user.userId, tokenHash },
          });
          console.warn(
            "Password reset email was not sent because SMTP is not configured.",
          );
        }
      } catch (error) {
        await prisma.passwordResetToken.deleteMany({
          where: { userId: user.userId, tokenHash },
        });
        console.error("Unable to send password reset email:", error.message);
      }
    }
  } catch (error) {
    console.error("Unable to process password reset request:", error.message);
  }

  return response.status(202).json(forgotPasswordResponse);
}

async function resetPassword(request, response, next) {
  const errors = {};
  const passwordError = validatePassword(request.body?.password);
  const unexpectedFields = Object.keys(request.body ?? {}).filter(
    (field) => !["token", "password"].includes(field),
  );

  if (unexpectedFields.length > 0) {
    errors.request = `Unexpected fields: ${unexpectedFields.join(", ")}.`;
  }

  if (typeof request.body?.token !== "string" || !request.body.token.trim()) {
    errors.token = "A password reset token is required.";
  }

  if (passwordError) {
    errors.password = passwordError;
  }

  if (Object.keys(errors).length > 0) {
    return sendValidationError(response, errors);
  }

  const tokenHash = hashPasswordResetToken(request.body.token.trim());

  try {
    const resetToken = await prisma.passwordResetToken.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { passwordResetTokenId: true, userId: true },
    });

    if (!resetToken) {
      return sendInvalidResetToken(response);
    }

    const passwordHash = await hashPassword(request.body.password);

    await prisma.$transaction(async (transaction) => {
      const usedAt = new Date();
      const claimedToken = await transaction.passwordResetToken.updateMany({
        where: {
          passwordResetTokenId: resetToken.passwordResetTokenId,
          usedAt: null,
          expiresAt: { gt: usedAt },
        },
        data: { usedAt },
      });

      if (claimedToken.count !== 1) {
        throw new InvalidPasswordResetTokenError();
      }

      await transaction.user.update({
        where: { userId: resetToken.userId },
        data: {
          passwordHash,
          sessionVersion: { increment: 1 },
        },
      });

      await transaction.passwordResetToken.updateMany({
        where: { userId: resetToken.userId, usedAt: null },
        data: { usedAt },
      });
    });

    return response.status(200).json({
      message: "Password reset successfully.",
    });
  } catch (error) {
    if (error instanceof InvalidPasswordResetTokenError) {
      return sendInvalidResetToken(response);
    }

    return next(error);
  }
}

async function validateSession(request, response, next) {
  const authorization = request.get("authorization");
  const [scheme, token, extra] = authorization?.split(/\s+/) ?? [];

  if (scheme?.toLowerCase() !== "bearer" || !token || extra) {
    return response.status(401).json({
      message: "Invalid or expired token.",
    });
  }

  let accessToken;

  try {
    accessToken = verifyAccessToken(token);
  } catch {
    return response.status(401).json({
      message: "Invalid or expired token.",
    });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { userId: accessToken.userId },
      select: sessionUserSelect,
    });

    if (!user || user.sessionVersion !== accessToken.sessionVersion) {
      return response.status(401).json({
        message: "Invalid or expired token.",
      });
    }

    return response.status(200).json({ user: toPublicUser(user) });
  } catch (error) {
    return next(error);
  }
}

export { forgotPassword, login, resetPassword, signup, validateSession };
