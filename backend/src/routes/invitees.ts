import { Router } from "express";
import multer from "multer";
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
} from "../services/inviteeService";
import { adminOnly } from "../middleware/adminOnly";
import { allowRoles } from "../middleware/roles";
import { parseFileBuffer } from "../services/importService";
import { ListType } from "@prisma/client";
import { EventRequest } from "../middleware/eventAccess";

const upload = multer();
const router = Router();

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

// GET /invitees - Lista tutti gli invitati
router.get("/", async (req: EventRequest, res, next) => {
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
