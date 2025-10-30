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
} from "../services/inviteeService";
import { authenticate } from "../middleware/auth";
import { adminOnly } from "../middleware/adminOnly";
import { parseFileBuffer } from "../services/importService";
import { keepOneAndDeleteOthersInGroup, promoteDuplicateGroupToPagante } from "../services/inviteeService";
import { ListType } from "@prisma/client";

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
    (candidate.listType === 'PAGANTE' || candidate.listType === 'GREEN')
  );
};

router.use(authenticate);

// GET /invitees - Lista tutti gli invitati
router.get("/", async (_req, res, next) => {
  try {
    const invitees = await listInvitees();
    return res.json(invitees);
  } catch (error) {
    return next(error);
  }
});

// GET /invitees/search?q=mario - Ricerca invitati
router.get("/search", async (req, res, next) => {
  try {
    const query = req.query.q as string;
    if (!query || query.trim().length === 0) {
      return res.status(400).json({ message: "Query di ricerca mancante" });
    }
    const invitees = await searchInvitees(query);
    return res.json(invitees);
  } catch (error) {
    return next(error);
  }
});

// GET /invitees/stats - Statistiche per i contatori
router.get("/stats", async (_req, res, next) => {
  try {
    const stats = await getStats();
    return res.json(stats);
  } catch (error) {
    return next(error);
  }
});

// POST /invitees - Crea nuovo invitato (o array di invitati)
router.post("/", async (req, res, next) => {
  try {
    const payload = req.body;
    if (Array.isArray(payload)) {
      const valid = payload.filter(isValidInvitee);
      const results = await createInviteesBulk(valid);
      return res.status(201).json(results);
    }

    if (!isValidInvitee(payload)) {
      return res.status(400).json({ message: "Nome, cognome e tipo lista sono obbligatori" });
    }

    const result = await createInvitee(payload);
    return res.status(201).json(result);
  } catch (error) {
    return next(error);
  }
});

// POST /invitees/upload - Upload file (Excel/CSV)
router.post("/upload", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ message: "File mancante" });
    }

    const items = parseFileBuffer(req.file.buffer);
    const created = await createInviteesBulk(items);
    return res.status(201).json({
      imported: created.length,
      skipped: items.length - created.length,
      total: items.length,
    });
  } catch (error) {
    return next(error);
  }
});

// POST /invitees/:id/checkin - Marca come entrato/non entrato
router.post("/:id/checkin", async (req, res, next) => {
  try {
    const { adminOverride } = req.body;
    const userRole = (req as any).user?.role;

    // Solo admin può usare adminOverride per rimettere come "non entrato"
    const canOverride = userRole === 'ADMIN' && adminOverride === true;

    const invitee = await markCheckIn(req.params.id, canOverride);
    return res.json(invitee);
  } catch (error) {
    return next(error);
  }
});

// PATCH /invitees/:id/reset - Resetta check-in (solo admin)
router.patch("/:id/reset", async (req, res, next) => {
  try {
    const userRole = (req as any).user?.role;
    if (userRole !== 'ADMIN') {
      return res.status(403).json({ message: "Solo admin può resettare il check-in" });
    }

    const invitee = await resetCheckIn(req.params.id);
    return res.json(invitee);
  } catch (error) {
    return next(error);
  }
});

// DELETE /invitees/:id - Elimina invitato (solo admin)
router.delete("/:id", async (req, res, next) => {
  try {
    const userRole = (req as any).user?.role;
    if (userRole !== 'ADMIN') {
      return res.status(403).json({ message: "Solo admin può eliminare invitati" });
    }

    await deleteInvitee(req.params.id);
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

export default router;
// GET /invitees/duplicates - Gruppi di duplicati per nome+cognome (solo admin)
router.get("/duplicates", adminOnly, async (_req, res, next) => {
  try {
    const groups = await getDuplicateInviteeGroups();
    return res.json(groups);
  } catch (error) {
    return next(error);
  }
});

// POST /invitees/duplicates/promote - Promuovi tutti i record del gruppo a PAGANTE
router.post("/duplicates/promote", adminOnly, async (req, res, next) => {
  try {
    const { key, paymentType } = req.body as { key?: string; paymentType?: string };
    if (!key) return res.status(400).json({ message: "Parametro 'key' mancante" });
    const result = await promoteDuplicateGroupToPagante(key, paymentType);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

// POST /invitees/duplicates/keep-one - Tieni un record e elimina gli altri del gruppo
router.post("/duplicates/keep-one", adminOnly, async (req, res, next) => {
  try {
    const { key, keepId } = req.body as { key?: string; keepId?: string };
    if (!key || !keepId) return res.status(400).json({ message: "Parametri 'key' e 'keepId' richiesti" });
    const result = await keepOneAndDeleteOthersInGroup(key, keepId);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});
