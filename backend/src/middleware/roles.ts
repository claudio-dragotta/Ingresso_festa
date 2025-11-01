import { Request, Response, NextFunction } from "express";

type Role = "ADMIN" | "ENTRANCE" | "ORGANIZER" | "SHUTTLE";

const getRole = (req: Request): Role | undefined => (req as any).user?.role as Role | undefined;

export const adminOrOrganizerOnly = (req: Request, res: Response, next: NextFunction) => {
  const role = getRole(req);
  if (role !== "ADMIN" && role !== "ORGANIZER") {
    return res.status(404).json({ message: "Endpoint non trovato" });
  }
  return next();
};

export const shuttleReadOnly = (_req: Request, _res: Response, next: NextFunction) => next();

export const shuttleWrite = (req: Request, res: Response, next: NextFunction) => {
  const role = getRole(req);
  if (role === "ADMIN" || role === "ORGANIZER" || role === "SHUTTLE") return next();
  return res.status(404).json({ message: "Endpoint non trovato" });
};

export const shuttleAccess = (req: Request, res: Response, next: NextFunction) => {
  const role = getRole(req);
  if (role === "ADMIN" || role === "ORGANIZER" || role === "SHUTTLE") return next();
  return res.status(404).json({ message: "Endpoint non trovato" });
};

export const allowRoles = (roles: Role[]) => (req: Request, res: Response, next: NextFunction) => {
  const role = getRole(req);
  if (role && roles.includes(role)) return next();
  return res.status(404).json({ message: "Endpoint non trovato" });
};
