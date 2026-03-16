import { Router } from "express";
import { adminOnly } from "../middleware/adminOnly";
import { getEvent, updateEvent } from "../services/eventService";
import { EventRequest } from "../middleware/eventAccess";

const router = Router();

// GET /settings/state - Ottieni stato della festa corrente
router.get("/state", adminOnly, async (req: EventRequest, res, next) => {
  try {
    const event = await getEvent(req.eventId!);
    return res.json({
      eventName: event.name,
      eventStatus: event.status,
      date: event.date,
      modules: event.modules,
      googleSheetId: event.googleSheetId,
    });
  } catch (error) {
    return next(error);
  }
});

// PATCH /settings/state - Aggiorna stato della festa corrente
router.patch("/state", adminOnly, async (req: EventRequest, res, next) => {
  try {
    const { status, name } = req.body;
    if (!status && !name) {
      return res.status(400).json({ message: "Almeno uno tra stato e nome è richiesto" });
    }

    const updated = await updateEvent(req.eventId!, {
      ...(status ? { status } : {}),
      ...(name ? { name } : {}),
    });

    return res.json({
      eventName: updated.name,
      eventStatus: updated.status,
      date: updated.date,
      modules: updated.modules,
      googleSheetId: updated.googleSheetId,
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
