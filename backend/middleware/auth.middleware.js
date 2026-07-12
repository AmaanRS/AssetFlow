import { hasPermission } from "../config/roles.js";
import { prisma } from "../database/prisma.js";
import { verifyAccessToken } from "../utils/jwt.js";

const authenticatedUserSelect = {
  userId: true,
  role: true,
  departmentId: true,
  sessionVersion: true,
};

function sendAuthenticationError(response) {
  return response.status(401).json({
    message: "Invalid or expired token.",
  });
}

async function authenticate(request, response, next) {
  const authorization = request.get("authorization");
  const [scheme, token, extra] = authorization?.split(/\s+/) ?? [];

  if (scheme?.toLowerCase() !== "bearer" || !token || extra) {
    return sendAuthenticationError(response);
  }

  let accessToken;

  try {
    accessToken = verifyAccessToken(token);
  } catch {
    return sendAuthenticationError(response);
  }

  try {
    const user = await prisma.user.findUnique({
      where: { userId: accessToken.userId },
      select: authenticatedUserSelect,
    });

    if (!user || user.sessionVersion !== accessToken.sessionVersion) {
      return sendAuthenticationError(response);
    }

    const { sessionVersion: _sessionVersion, ...authenticatedUser } = user;
    request.user = authenticatedUser;

    return next();
  } catch (error) {
    return next(error);
  }
}

function authorize(permission) {
  return function checkPermission(request, response, next) {
    if (!request.user || !hasPermission(request.user.role, permission)) {
      return response.status(403).json({
        message: "You do not have permission to perform this action.",
      });
    }

    return next();
  };
}

export { authenticate, authorize };
