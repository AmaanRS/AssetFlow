import bcrypt from "bcrypt";

const SALT_ROUNDS = 12;

async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function verifyPassword(password, storedHash) {
  if (typeof storedHash !== "string") {
    return false;
  }

  try {
    return await bcrypt.compare(password, storedHash);
  } catch {
    return false;
  }
}

export { hashPassword, verifyPassword };
