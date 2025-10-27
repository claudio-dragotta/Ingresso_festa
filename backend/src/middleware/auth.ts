import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { AppError } from "../utils/errors";

export interface AuthPayload {
  username: string;
}

export const authenticate = (req: Request, _res: Response, next: NextFunction) => {
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
    (req as Request & { user?: AuthPayload }).user = payload;
    return next();
  } catch (error) {
    return next(new AppError("Token non valido", 401));
  }
};
