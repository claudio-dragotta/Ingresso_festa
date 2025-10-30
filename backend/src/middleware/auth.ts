import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { AppError } from "../utils/errors";
import { prisma } from "../lib/prisma";

export interface AuthPayload {
  username: string;
  role?: "ADMIN" | "ENTRANCE";
  userId?: string; // presente per utenti DB
}

export const authenticate = async (req: Request, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header) {
    return next(new AppError("Autenticazione richiesta", 401));
  }

  const [, token] = header.split(" ");
  if (!token) {
    return next(new AppError("Token mancante", 401));
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret) as AuthPayload;
    // Se il token appartiene a un utente del DB, verifica che sia ancora attivo
    if (payload.userId) {
      const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { id: true, active: true } });
      if (!user || !user.active) {
        return next(new AppError("Account disattivato", 401));
      }
    } else {
      // Token da utente ENV: verifica se esiste e se è attivo (se definito in USERS_JSON)
      const envUser = config.envUsers?.find((u) => u.username === payload.username);
      if (envUser && envUser.active === false) {
        return next(new AppError("Account disattivato", 401));
      }
      // Per admin fallback ENV (senza envUsers), non applichiamo controllo attivo
    }
    (req as Request & { user?: AuthPayload }).user = payload;
    return next();
  } catch (error) {
    return next(new AppError("Token non valido", 401));
  }
};
