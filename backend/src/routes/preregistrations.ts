import { Router, Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import { prisma } from "../lib/prisma";
import { AppError } from "../utils/errors";
import { ListType } from "@prisma/client";
import { allowRoles } from "../middleware/roles";
import { EventRequest } from "../middleware/eventAccess";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Dominio istituzionale richiesto — NON esposto nelle risposte API
const ALLOWED_DOMAIN = "alcampus.it";

// Limiti di lunghezza campi (protezione DoS e stress DB)
const MAX_NAME_LEN = 100;
const MAX_EMAIL_LEN = 254; // RFC 5321
const MAX_NOTES_LEN = 500;

// Rate limiter: max 5 registrazioni per IP ogni 15 minuti
const registerRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Troppi tentativi. Riprova tra 15 minuti." },
  skipSuccessfulRequests: false,
});

// ── Endpoint PUBBLICO (no auth) ──────────────────────────────────────────────
// POST /api/register/:eventId   – invitato si auto-registra
// GET  /api/register/:eventId/info – recupera nome evento (per la pagina pubblica)
export const publicPreRegRouter = Router({ mergeParams: true });

// GET /api/register/active — restituisce il primo evento ACTIVE (nessun eventId necessario)
publicPreRegRouter.get("/active", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const event = await prisma.event.findFirst({
      where: { status: "ACTIVE" },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, status: true },
    });
    if (!event) throw new AppError("Nessun evento attivo", 404);
    return res.json(event);
  } catch (err) {
    return next(err);
  }
});

publicPreRegRouter.get("/:eventId/info", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const event = await prisma.event.findUnique({
      where: { id: req.params.eventId },
      select: { id: true, name: true, status: true },
    });
    if (!event) throw new AppError("Evento non trovato", 404);
    return res.json(event);
  } catch (err) {
    return next(err);
  }
});

publicPreRegRouter.post("/:eventId", registerRateLimit, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { eventId } = req.params;
    const { firstName, lastName, email, notes } = req.body as Record<string, string | undefined>;

    if (!firstName?.trim() || !lastName?.trim() || !email?.trim()) {
      throw new AppError("Nome, cognome e email sono obbligatori", 400);
    }
    if (firstName.trim().length > MAX_NAME_LEN || lastName.trim().length > MAX_NAME_LEN) {
      throw new AppError("Nome o cognome troppo lunghi (max 100 caratteri)", 400);
    }
    if (email.trim().length > MAX_EMAIL_LEN) {
      throw new AppError("Email troppo lunga", 400);
    }
    if (notes && notes.trim().length > MAX_NOTES_LEN) {
      throw new AppError("Note troppo lunghe (max 500 caratteri)", 400);
    }
    if (!EMAIL_RE.test(email.trim())) {
      throw new AppError("Formato email non valido", 400);
    }

    const [localPart, emailDomain] = email.trim().toLowerCase().split("@");

    // Controlla dominio istituzionale — messaggio generico, non rivela il dominio
    if (emailDomain !== ALLOWED_DOMAIN) {
      throw new AppError("Devi utilizzare la tua email istituzionale universitaria per registrarti.", 400);
    }

    // Controlla che il cognome corrisponda alla parte della mail dopo il primo punto
    // Es. mario.dragotta@alcampus.it → "dragotta" deve corrispondere al cognome inserito

    const event = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true } });
    if (!event) throw new AppError("Evento non trovato", 404);

    // blocca duplicati (stessa email + stesso evento, non già rifiutata)
    const existing = await prisma.preRegistration.findFirst({
      where: { eventId, email: email.trim().toLowerCase(), status: { not: "REJECTED" } },
    });
    if (existing) {
      throw new AppError("Hai già effettuato la pre-registrazione con questa email", 409);
    }

    await prisma.preRegistration.create({
      data: {
        eventId,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        notes: notes?.trim() || null,
      },
    });

    return res.status(201).json({ success: true });
  } catch (err) {
    return next(err);
  }
});

// ── Endpoint PROTETTI (solo admin/organizer) ─────────────────────────────────
const router = Router();

// GET /events/:eventId/preregistrations
router.get("/", allowRoles(["ADMIN", "ORGANIZER"]), async (req: EventRequest, res: Response, next: NextFunction) => {
  try {
    const items = await prisma.preRegistration.findMany({
      where: { eventId: req.eventId! },
      orderBy: { createdAt: "desc" },
    });
    return res.json(items);
  } catch (err) {
    return next(err);
  }
});

// POST /events/:eventId/preregistrations/:id/approve
router.post("/:id/approve", allowRoles(["ADMIN", "ORGANIZER"]), async (req: EventRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { listType, paymentType } = req.body as { listType?: string; paymentType?: string };

    const preReg = await prisma.preRegistration.findFirst({ where: { id, eventId: req.eventId! } });
    if (!preReg) throw new AppError("Pre-registrazione non trovata", 404);
    if (preReg.status !== "PENDING") throw new AppError("Pre-registrazione già processata", 400);

    const finalListType: ListType = listType === "GREEN" ? "GREEN" : "PAGANTE";

    const invitee = await prisma.invitee.create({
      data: {
        eventId: req.eventId!,
        firstName: preReg.firstName,
        lastName: preReg.lastName,
        email: preReg.email,
        listType: finalListType,
        paymentType: paymentType?.trim() || null,
      },
    });

    await prisma.preRegistration.update({ where: { id }, data: { status: "APPROVED" } });

    return res.json({ success: true, invitee });
  } catch (err) {
    return next(err);
  }
});

// POST /events/:eventId/preregistrations/:id/reject
router.post("/:id/reject", allowRoles(["ADMIN", "ORGANIZER"]), async (req: EventRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const preReg = await prisma.preRegistration.findFirst({ where: { id, eventId: req.eventId! } });
    if (!preReg) throw new AppError("Pre-registrazione non trovata", 404);

    await prisma.preRegistration.update({ where: { id }, data: { status: "REJECTED" } });
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

// DELETE /events/:eventId/preregistrations/:id
router.delete("/:id", allowRoles(["ADMIN", "ORGANIZER"]), async (req: EventRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await prisma.preRegistration.deleteMany({ where: { id, eventId: req.eventId! } });
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

export default router;
