import { Router } from "express";
import multer from "multer";
import {
  createInvitee,
  createInviteesBulk,
  deleteInvitee,
  getInviteeQr,
  listInvitees,
  resetCheckIn,
  sendInviteeQr,
} from "../services/inviteeService";
import { authenticate } from "../middleware/auth";
import { parseFileBuffer } from "../services/importService";

const upload = multer();
const router = Router();

const isValidInvitee = (value: unknown): value is {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
} => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.firstName === "string" && typeof candidate.lastName === "string";
};

router.use(authenticate);

router.get("/", async (_req, res, next) => {
  try {
    const invitees = await listInvitees();
    return res.json(invitees);
  } catch (error) {
    return next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const payload = req.body;
    if (Array.isArray(payload)) {
      const valid = payload.filter(isValidInvitee);
      const results = await createInviteesBulk(valid);
      return res.status(201).json(results.map((item) => item.invitee));
    }

    if (!isValidInvitee(payload)) {
      return res.status(400).json({ message: "Nome e cognome sono obbligatori" });
    }

    const result = await createInvitee(payload);
    return res.status(201).json(result.invitee);
  } catch (error) {
    return next(error);
  }
});

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

router.post("/:id/send", async (req, res, next) => {
  try {
    await sendInviteeQr(req.params.id);
    return res.json({ message: "Email inviata" });
  } catch (error) {
    return next(error);
  }
});

router.get("/:id/qr", async (req, res, next) => {
  try {
    const qr = await getInviteeQr(req.params.id);
    res.setHeader("Content-Type", qr.mimeType);
    res.setHeader("Content-Disposition", `inline; filename=\"${qr.filename}\"`);
    return res.send(qr.buffer);
  } catch (error) {
    return next(error);
  }
});

router.patch("/:id/reset", async (req, res, next) => {
  try {
    const invitee = await resetCheckIn(req.params.id);
    return res.json(invitee);
  } catch (error) {
    return next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    await deleteInvitee(req.params.id);
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

export default router;
