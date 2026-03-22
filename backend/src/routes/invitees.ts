import { Router } from "express";
import multer from "multer";
import rateLimit from "express-rate-limit";
import {
  createInvitee,
  createInviteesBulk,
  deleteInvitee,
  listInvitees,
  searchInvitees,
  resetCheckIn,
  markCheckIn,
  getStats,
  getDuplicateInviteeGroups,
  keepOneAndDeleteOthersInGroup,
  promoteDuplicateGroupToPagante,
  updateInviteeEmail,
} from "../services/inviteeService";
import { adminOnly } from "../middleware/adminOnly";
import { allowRoles } from "../middleware/roles";
import { parseFileBuffer } from "../services/importService";
import { ListType } from "@prisma/client";
import { EventRequest } from "../middleware/eventAccess";
import { isValidQrToken, ensureQrToken, generateQrImageBuffer } from "../services/qrService";
import { sendQrEmail, sendQrEmailBulk } from "../services/emailService";
import { prisma } from "../lib/prisma";
import { AppError } from "../utils/errors";

const upload = multer({ limits: { fileSize: 5 * 1024 * 1024 } }); // max 5 MB
const router = Router();

const MAX_NAME_LEN = 100;

// Rate limit specifico per il check-in QR (60 tentativi/min per IP — ~1/s per operatore reale)
const checkinRateLimit = rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Troppi tentativi di check-in. Riprova tra un minuto." },
});

const isValidInvitee = (value: unknown): value is {
  firstName: string;
  lastName: string;
  listType: ListType;
  paymentType?: string;
} => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.firstName === "string" &&
    typeof candidate.lastName === "string" &&
    (candidate.listType === "PAGANTE" || candidate.listType === "GREEN")
  );
};

// GET /invitees - Lista tutti gli invitati (solo ruoli che gestiscono la lista)
router.get("/", allowRoles(["ADMIN", "ORGANIZER", "ENTRANCE"]), async (req: EventRequest, res, next) => {
  try {
    const invitees = await listInvitees(req.eventId!);
    return res.json(invitees);
  } catch (error) {
    return next(error);
  }
});

// GET /invitees/search?q=mario - Ricerca invitati
router.get("/search", allowRoles(["ADMIN", "ORGANIZER", "ENTRANCE"]), async (req: EventRequest, res, next) => {
  try {
    const query = req.query.q as string;
    if (!query || query.trim().length === 0) {
      return res.status(400).json({ message: "Query di ricerca mancante" });
    }
    const invitees = await searchInvitees(query, req.eventId!);
    return res.json(invitees);
  } catch (error) {
    return next(error);
  }
});

// GET /invitees/stats - Statistiche per i contatori
router.get("/stats", allowRoles(["ADMIN", "ORGANIZER", "ENTRANCE"]), async (req: EventRequest, res, next) => {
  try {
    const stats = await getStats(req.eventId!);
    return res.json(stats);
  } catch (error) {
    return next(error);
  }
});

// GET /invitees/duplicates - Gruppi di duplicati per nome+cognome (solo admin)
router.get("/duplicates", adminOnly, async (req: EventRequest, res, next) => {
  try {
    const groups = await getDuplicateInviteeGroups(req.eventId!);
    return res.json(groups);
  } catch (error) {
    return next(error);
  }
});

// POST /invitees - Crea nuovo invitato (o array di invitati)
router.post("/", allowRoles(["ADMIN", "ORGANIZER"]), async (req: EventRequest, res, next) => {
  try {
    const payload = req.body;
    const userRole = (req as any).user?.role as "ADMIN" | "ORGANIZER" | undefined;

    // Blocca import multiplo per ORGANIZER
    if (Array.isArray(payload)) {
      if (userRole !== "ADMIN") {
        return res.status(403).json({ message: "Solo admin può importare più invitati alla volta" });
      }
      const valid = payload.filter(isValidInvitee);
      const results = await createInviteesBulk(valid, req.eventId!);
      return res.status(201).json(results);
    }

    if (!isValidInvitee(payload)) {
      return res.status(400).json({ message: "Nome, cognome e tipo lista sono obbligatori" });
    }
    if (payload.firstName.trim().length > MAX_NAME_LEN || payload.lastName.trim().length > MAX_NAME_LEN) {
      return res.status(400).json({ message: `Nome e cognome non possono superare ${MAX_NAME_LEN} caratteri` });
    }

    const result = await createInvitee(payload, req.eventId!);
    return res.status(201).json(result);
  } catch (error) {
    return next(error);
  }
});

// POST /invitees/upload - Upload file (Excel/CSV)
router.post("/upload", adminOnly, upload.single("file"), async (req: EventRequest, res, next) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ message: "File mancante" });
    }

    const items = parseFileBuffer(req.file.buffer);
    const created = await createInviteesBulk(items, req.eventId!);
    return res.status(201).json({
      imported: created.length,
      skipped: items.length - created.length,
      total: items.length,
    });
  } catch (error) {
    return next(error);
  }
});

// POST /invitees/duplicates/promote - Promuovi tutti i record del gruppo a PAGANTE
router.post("/duplicates/promote", adminOnly, async (req: EventRequest, res, next) => {
  try {
    const { key, paymentType } = req.body as { key?: string; paymentType?: string };
    if (!key) return res.status(400).json({ message: "Parametro 'key' mancante" });
    const result = await promoteDuplicateGroupToPagante(key, paymentType, req.eventId!);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

// POST /invitees/duplicates/keep-one - Tieni un record e elimina gli altri del gruppo
router.post("/duplicates/keep-one", adminOnly, async (req: EventRequest, res, next) => {
  try {
    const { key, keepId } = req.body as { key?: string; keepId?: string };
    if (!key || !keepId) return res.status(400).json({ message: "Parametri 'key' e 'keepId' richiesti" });
    const result = await keepOneAndDeleteOthersInGroup(key, keepId, req.eventId!);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

// POST /invitees/qr/checkin - Check-in via token QR (richiede autenticazione)
// DEVE stare PRIMA di /:id/checkin altrimenti Express matcha "qr" come :id
router.post("/qr/checkin", checkinRateLimit, allowRoles(["ADMIN", "ORGANIZER", "ENTRANCE"]), async (req: EventRequest, res, next) => {
  try {
    const { token } = req.body as { token?: string };

    if (!token) {
      return res.status(400).json({ message: "Token mancante" });
    }

    // Validazione regex — difesa in profondità contro input malevoli
    if (!isValidQrToken(token)) {
      return res.status(400).json({ message: "Token non valido" });
    }

    // Cerca invitato per token (query parametrizzata Prisma — nessuna SQL injection possibile)
    const invitee = await prisma.invitee.findUnique({
      where: { qrToken: token },
      select: { id: true, eventId: true },
    });

    if (!invitee) {
      return res.status(404).json({ message: "QR code non riconosciuto" });
    }

    // Verifica che l'invitato appartenga all'evento corrente
    if (req.eventId && invitee.eventId !== req.eventId) {
      return res.status(403).json({ message: "QR code non valido per questo evento" });
    }

    const performedByUserId = (req as any).user?.userId as string | undefined;
    const updated = await markCheckIn(invitee.id, false, performedByUserId, invitee.eventId);
    return res.json(updated);
  } catch (error) {
    return next(error);
  }
});

// POST /invitees/:id/checkin - Marca come entrato/non entrato
router.post("/:id/checkin", async (req: EventRequest, res, next) => {
  try {
    const { adminOverride } = req.body;
    const userRole = (req as any).user?.role;
    const performedByUserId = (req as any).user?.userId as string | undefined;

    // Admin, ingresso e organizer possono effettuare check-in
    if (userRole !== "ADMIN" && userRole !== "ENTRANCE" && userRole !== "ORGANIZER") {
      return res.status(403).json({ message: "Solo admin, ingresso o organizer possono effettuare check-in" });
    }

    // Solo admin può usare adminOverride per rimettere come "non entrato"
    const canOverride = userRole === "ADMIN" && adminOverride === true;

    const invitee = await markCheckIn(req.params.id, canOverride, performedByUserId, req.eventId!);
    return res.json(invitee);
  } catch (error) {
    return next(error);
  }
});

// PATCH /invitees/:id/reset - Resetta check-in (solo admin)
router.patch("/:id/reset", async (req: EventRequest, res, next) => {
  try {
    const userRole = (req as any).user?.role;
    if (userRole !== "ADMIN") {
      return res.status(403).json({ message: "Solo admin può resettare il check-in" });
    }

    const invitee = await resetCheckIn(req.params.id);
    return res.json(invitee);
  } catch (error) {
    return next(error);
  }
});

// PATCH /invitees/:id/email - Aggiorna email invitato
router.patch("/:id/email", allowRoles(["ADMIN", "ORGANIZER"]), async (req: EventRequest, res, next) => {
  try {
    const { email } = req.body as { email?: string };
    const updated = await updateInviteeEmail(req.params.id, email ?? null);
    return res.json(updated);
  } catch (error) {
    return next(error);
  }
});

// GET /invitees/:id/qr-image - Scarica immagine QR come PNG (admin only)
router.get("/:id/qr-image", adminOnly, async (req: EventRequest, res, next) => {
  try {
    const token = await ensureQrToken(req.params.id);
    const buffer = await generateQrImageBuffer(token);
    const invitee = await prisma.invitee.findUnique({
      where: { id: req.params.id },
      select: { firstName: true, lastName: true },
    });
    const safeSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    const filename = invitee
      ? `qr-${safeSlug(invitee.lastName)}-${safeSlug(invitee.firstName)}.png`
      : "qr.png";
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.send(buffer);
  } catch (error) {
    return next(error);
  }
});

// POST /invitees/:id/send-qr - Genera token e invia email QR
router.post("/:id/send-qr", allowRoles(["ADMIN", "ORGANIZER"]), async (req: EventRequest, res, next) => {
  try {
    const result = await sendQrEmail(req.params.id);
    if (!result.success) {
      return res.status(400).json({ message: result.error });
    }
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

// POST /invitees/send-qr-bulk - Invia QR a tutti gli invitati con email (admin e organizer)
router.post("/send-qr-bulk", allowRoles(["ADMIN", "ORGANIZER"]), async (req: EventRequest, res, next) => {
  try {
    const result = await sendQrEmailBulk(req.eventId!);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

// PATCH /invitees/:id/revoke-qr - Invalida il token QR senza eliminare l'invitato (solo admin)
router.patch("/:id/revoke-qr", adminOnly, async (req: EventRequest, res, next) => {
  try {
    const updated = await prisma.invitee.update({
      where: { id: req.params.id },
      data: { qrToken: null, qrSentAt: null },
      select: { id: true, firstName: true, lastName: true, qrToken: true, qrSentAt: true },
    });
    return res.json({ message: "Token QR revocato", invitee: updated });
  } catch (error: any) {
    if (error?.code === "P2025") {
      return next(new AppError("Invitato non trovato", 404));
    }
    return next(error);
  }
});

// DELETE /invitees/:id - Elimina invitato (admin o organizer evento)
router.delete("/:id", async (req: EventRequest, res, next) => {
  try {
    const globalRole = (req as any).user?.role;
    const eventRole = req.eventRole;
    if (globalRole !== "ADMIN" && eventRole !== "ADMIN" && eventRole !== "ORGANIZER") {
      return res.status(403).json({ message: "Solo admin o organizer può eliminare invitati" });
    }

    await deleteInvitee(req.params.id);
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

export default router;
