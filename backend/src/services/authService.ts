import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { config } from "../config";
import { AppError } from "../utils/errors";

const PASSWORD_PREFIX = "$2b$";

const isHashed = (value: string) => value.startsWith(PASSWORD_PREFIX);

const verifyPassword = async (plain: string, stored: string) => {
  if (isHashed(stored)) {
    return bcrypt.compare(plain, stored);
  }

  // Fallback to plain comparison for development convenience.
  return plain === stored;
};

export const login = async (username: string, password: string) => {
  if (username !== config.adminUsername) {
    throw new AppError("Credenziali non valide", 401);
  }

  const valid = await verifyPassword(password, config.adminPassword);
  if (!valid) {
    throw new AppError("Credenziali non valide", 401);
  }

  const token = jwt.sign({ username }, config.jwtSecret, { expiresIn: "12h" });
  return token;
};
