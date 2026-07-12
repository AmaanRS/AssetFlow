import jwt from "jsonwebtoken";
import { config } from "../config/config.js";

const jwtSecret = config.get("JWT_SECRET");
const jwtExpiresIn = config.get("JWT_EXPIRES_IN");

if (jwtSecret.length < 32) {
  throw new Error("JWT_SECRET must contain at least 32 characters.");
}

function createAccessToken(user) {
  return jwt.sign(
    {
      role: user.role,
      departmentId: user.departmentId,
      sessionVersion: user.sessionVersion,
    },
    jwtSecret,
    {
      algorithm: "HS256",
      audience: "assetflow-api",
      expiresIn: jwtExpiresIn,
      issuer: "assetflow",
      subject: String(user.userId),
    },
  );
}

function verifyAccessToken(token) {
  const payload = jwt.verify(token, jwtSecret, {
    algorithms: ["HS256"],
    audience: "assetflow-api",
    issuer: "assetflow",
  });

  const userId = Number(payload.sub);

  if (
    !Number.isInteger(userId) ||
    userId <= 0 ||
    !Number.isInteger(payload.sessionVersion) ||
    payload.sessionVersion < 0
  ) {
    throw new jwt.JsonWebTokenError("Invalid access-token claims.");
  }

  return {
    sessionVersion: payload.sessionVersion,
    userId,
  };
}

export { createAccessToken, verifyAccessToken };
