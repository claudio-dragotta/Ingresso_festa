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
    if (!user.active) {
      throw new AppError("Utente disattivato", 403);
    }
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

  // Fallback: utente admin legacy da environment variables (opzionale)
  if (!config.disableEnvAdminFallback && config.adminUsername && username === config.adminUsername) {
    const valid = await verifyPassword(password, config.adminPassword!);
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

  // Fallback: utenti definiti via ENV (USERS_JSON / AUTH_USERS_JSON)
  const envUser = config.envUsers?.find((u) => u.username === username);
  if (envUser) {
    if (!envUser.active) {
      throw new AppError("Utente disattivato", 403);
    }
    const valid = await verifyPassword(password, envUser.password);
    if (!valid) {
      throw new AppError("Credenziali non valide", 401);
    }
    const token = jwt.sign(
      {
        username: envUser.username,
        role: envUser.role,
      },
      config.jwtSecret,
      { expiresIn: "12h" }
    );
    return { token, role: envUser.role as UserRole };
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
      active: true,
      createdAt: true,
    },
  });
};

export const deleteUser = async (userId: string) => {
  await prisma.user.delete({
    where: { id: userId },
  });
};

export const setUserActive = async (userId: string, active: boolean) => {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { active },
    select: { id: true, username: true, role: true, active: true },
  });
  return user;
};

export const ensureDefaultAdmin = async () => {
  const admins = await prisma.user.count({ where: { role: 'ADMIN' } });
  if (admins > 0) return;

  // Prefer admin from USERS_JSON if present
  const envAdmin = config.envUsers?.find((u) => u.role === 'ADMIN' && u.active !== false);
  if (envAdmin) {
    const hashed = isHashed(envAdmin.password) ? envAdmin.password : await hashPassword(envAdmin.password);
    const existing = await prisma.user.findUnique({ where: { username: envAdmin.username } });
    if (existing) {
      await prisma.user.update({ where: { id: existing.id }, data: { role: 'ADMIN', password: hashed, active: true } });
    } else {
      await prisma.user.create({
        data: {
          username: envAdmin.username,
          password: hashed,
          role: 'ADMIN',
          active: true,
        },
      });
    }
    return;
  }

  // Fallback to legacy ADMIN env vars if available
  if (config.adminUsername && config.adminPassword) {
    const hashed = isHashed(config.adminPassword) ? config.adminPassword : await hashPassword(config.adminPassword);
    const existing = await prisma.user.findUnique({ where: { username: config.adminUsername } });
    if (existing) {
      await prisma.user.update({ where: { id: existing.id }, data: { role: 'ADMIN', password: hashed, active: true } });
    } else {
      await prisma.user.create({
        data: {
          username: config.adminUsername,
          password: hashed,
          role: 'ADMIN',
          active: true,
        },
      });
    }
  }
};
