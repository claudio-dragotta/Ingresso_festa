import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { config } from "../config";
import { AppError } from "../utils/errors";
import { prisma } from "../lib/prisma";
import { UserRole } from "@prisma/client";

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
  // Prima cerca nel database
  const user = await prisma.user.findUnique({
    where: { username },
  });

  if (user) {
    const valid = await verifyPassword(password, user.password);
    if (!valid) {
      throw new AppError("Credenziali non valide", 401);
    }

    const token = jwt.sign(
      {
        username: user.username,
        role: user.role,
        userId: user.id,
      },
      config.jwtSecret,
      { expiresIn: "12h" }
    );
    return { token, role: user.role };
  }

  // Fallback: utente admin legacy da environment variables
  if (username === config.adminUsername) {
    const valid = await verifyPassword(password, config.adminPassword);
    if (!valid) {
      throw new AppError("Credenziali non valide", 401);
    }

    const token = jwt.sign(
      {
        username,
        role: 'ADMIN',
      },
      config.jwtSecret,
      { expiresIn: "12h" }
    );
    return { token, role: 'ADMIN' as UserRole };
  }

  throw new AppError("Credenziali non valide", 401);
};

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, 10);
};

export const createUser = async (username: string, password: string, role: UserRole = 'ENTRANCE') => {
  const existingUser = await prisma.user.findUnique({
    where: { username },
  });

  if (existingUser) {
    throw new AppError("Username già in uso", 409);
  }

  const hashedPassword = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      username,
      password: hashedPassword,
      role,
    },
  });

  return user;
};

export const listUsers = async () => {
  return prisma.user.findMany({
    select: {
      id: true,
      username: true,
      role: true,
      createdAt: true,
    },
  });
};

export const deleteUser = async (userId: string) => {
  await prisma.user.delete({
    where: { id: userId },
  });
};
