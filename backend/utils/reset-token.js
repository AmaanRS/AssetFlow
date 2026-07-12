import { createHash, randomBytes } from "node:crypto";

function generatePasswordResetToken() {
  return randomBytes(32).toString("base64url");
}

function hashPasswordResetToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export { generatePasswordResetToken, hashPasswordResetToken };
