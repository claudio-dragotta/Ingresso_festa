import { Request, Response, NextFunction } from "express";

export const adminOnly = (req: Request, res: Response, next: NextFunction) => {
  const role = (req as any).user?.role;
  if (role !== 'ADMIN') {
    return res.status(404).json({ message: 'Endpoint non trovato' });
  }
  return next();
};

