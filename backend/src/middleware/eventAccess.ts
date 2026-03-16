import { Request, Response, NextFunction } from "express";
import { UserRole } from "@prisma/client";
import { AppError } from "../utils/errors";
import { prisma } from "../lib/prisma";
import { AuthPayload } from "./auth";

export interface EventRequest extends Request {
  user?: AuthPayload;
  eventId?: string;
  eventRole?: UserRole; // ruolo dell'utente per questo specifico evento
}

/**
 * Middleware che verifica che l'utente abbia accesso all'evento specificato in req.params.eventId.
 * - ADMIN globali: accesso automatico a tutti gli eventi
 * - Altri utenti: devono avere una voce in UserEventAccess per l'evento
 *
 * Aggiunge req.eventId e req.eventRole alla richiesta.
 */
export const requireEventAccess = (minRole?: UserRole) =>
  async (req: EventRequest, _res: Response, next: NextFunction) => {
    const { eventId } = req.params;
    if (!eventId) return next(new AppError("ID evento mancante", 400));

    const user = req.user;
    if (!user) return next(new AppError("Autenticazione richiesta", 401));

    req.eventId = eventId;

    // ADMIN globale: accesso completo
    if (user.role === "ADMIN") {
      req.eventRole = "ADMIN";
      return next();
    }

    // Verifica accesso tramite UserEventAccess
    if (!user.userId) return next(new AppError("Accesso negato", 403));

    const access = await prisma.userEventAccess.findUnique({
      where: { userId_eventId: { userId: user.userId, eventId } },
    });

    if (!access) return next(new AppError("Non hai accesso a questa festa", 403));

    // Controlla ruolo minimo se richiesto
    if (minRole) {
      const roleOrder: UserRole[] = ["ENTRANCE", "SHUTTLE", "ORGANIZER", "ADMIN"];
      const userIdx = roleOrder.indexOf(access.role);
      const minIdx = roleOrder.indexOf(minRole);
      if (userIdx < minIdx) {
        return next(new AppError("Permessi insufficienti per questa operazione", 403));
      }
    }

    req.eventRole = access.role;
    return next();
  };

/**
 * Middleware che richiede ruolo ORGANIZER o superiore per l'evento corrente.
 */
export const requireOrganizer = requireEventAccess("ORGANIZER");

/**
 * Controlla che il ruolo sia almeno ADMIN (globale).
 * Per azioni che richiedono admin globale (creare/eliminare feste).
 */
export const requireGlobalAdmin = (req: EventRequest, _res: Response, next: NextFunction) => {
  if (req.user?.role !== "ADMIN") {
    return next(new AppError("Richiede privilegi di amministratore globale", 403));
  }
  return next();
};
