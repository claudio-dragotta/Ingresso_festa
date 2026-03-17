import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireGlobalAdmin, EventRequest } from "../middleware/eventAccess";
import {
  listEvents,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
  listEventUsers,
  assignUserToEvent,
  removeUserFromEvent,
  setupGoogleSheet,
  ALL_MODULES,
  EventModule,
} from "../services/eventService";
import { UserRole } from "@prisma/client";

const router = Router();

router.use(authenticate);

// ===================== LISTA / CREA FESTE =====================

// GET /api/events — lista feste accessibili all'utente
router.get("/", async (req: EventRequest, res, next) => {
  try {
    const user = req.user!;
    const events = await listEvents(user.userId ?? "", user.role as UserRole);
    return res.json(events);
  } catch (error) {
    return next(error);
  }
});

// POST /api/events — crea nuova festa (solo ADMIN globale)
router.post("/", requireGlobalAdmin, async (req: EventRequest, res, next) => {
  try {
    const { name, date, modules, googleSheetId } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ message: "Nome festa richiesto" });
    }

    // Valida moduli
    const validModules = (modules as string[] ?? ALL_MODULES).filter((m) =>
      ALL_MODULES.includes(m as EventModule)
    ) as EventModule[];

    const event = await createEvent(
      name.trim(),
      date ? new Date(date) : undefined,
      validModules,
      googleSheetId?.trim() || undefined
    );

    return res.status(201).json(event);
  } catch (error) {
    return next(error);
  }
});

// ===================== SINGOLA FESTA =====================

// GET /api/events/:eventId
router.get("/:eventId", async (req: EventRequest, res, next) => {
  try {
    const event = await getEvent(req.params.eventId);
    return res.json(event);
  } catch (error) {
    return next(error);
  }
});

// PATCH /api/events/:eventId — modifica festa (solo ADMIN globale)
router.patch("/:eventId", requireGlobalAdmin, async (req: EventRequest, res, next) => {
  try {
    const { name, date, modules, status, googleSheetId } = req.body;

    const validModules = modules
      ? (modules as string[]).filter((m) => ALL_MODULES.includes(m as EventModule)) as EventModule[]
      : undefined;

    const event = await updateEvent(req.params.eventId, {
      name,
      date: date !== undefined ? (date ? new Date(date) : null) : undefined,
      modules: validModules,
      status,
      googleSheetId,
    });

    return res.json(event);
  } catch (error) {
    return next(error);
  }
});

// POST /api/events/:eventId/setup-sheet — configura i tab del Google Sheet collegato
router.post("/:eventId/setup-sheet", requireGlobalAdmin, async (req: EventRequest, res, next) => {
  try {
    const event = await getEvent(req.params.eventId);
    if (!event.googleSheetId) {
      return res.status(400).json({ message: "Nessun Google Sheet collegato a questa festa" });
    }
    await setupGoogleSheet(event.googleSheetId, event.modules as EventModule[]);
    return res.json({ message: "Sheet configurato correttamente" });
  } catch (error) {
    return next(error);
  }
});

// DELETE /api/events/:eventId — elimina festa (solo ADMIN globale)
router.delete("/:eventId", requireGlobalAdmin, async (req: EventRequest, res, next) => {
  try {
    await deleteEvent(req.params.eventId);
    return res.json({ message: "Festa eliminata" });
  } catch (error) {
    return next(error);
  }
});

// ===================== GESTIONE ACCESSI UTENTI =====================

// GET /api/events/:eventId/users — lista utenti con accesso alla festa
router.get("/:eventId/users", requireGlobalAdmin, async (req: EventRequest, res, next) => {
  try {
    const users = await listEventUsers(req.params.eventId);
    return res.json(users);
  } catch (error) {
    return next(error);
  }
});

// POST /api/events/:eventId/users — assegna utente a festa
router.post("/:eventId/users", requireGlobalAdmin, async (req: EventRequest, res, next) => {
  try {
    const { userId, role } = req.body;
    if (!userId || !role) {
      return res.status(400).json({ message: "userId e role richiesti" });
    }

    const validRoles: UserRole[] = ["ENTRANCE", "ORGANIZER", "SHUTTLE"];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: `Ruolo non valido. Valori: ${validRoles.join(", ")}` });
    }

    const access = await assignUserToEvent(userId, req.params.eventId, role as UserRole);
    return res.status(201).json(access);
  } catch (error) {
    return next(error);
  }
});

// DELETE /api/events/:eventId/users/:userId — rimuovi accesso utente
router.delete("/:eventId/users/:userId", requireGlobalAdmin, async (req: EventRequest, res, next) => {
  try {
    await removeUserFromEvent(req.params.userId, req.params.eventId);
    return res.json({ message: "Accesso rimosso" });
  } catch (error) {
    return next(error);
  }
});

export default router;
