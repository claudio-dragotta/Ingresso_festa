import { Router } from "express";
import { getDashboardMetrics } from "../services/systemService";
import { EventRequest } from "../middleware/eventAccess";

const router = Router();

router.get("/metrics", async (req: EventRequest, res, next) => {
  try {
    // Richiede almeno ORGANIZER o ADMIN per il dashboard
    const eventRole = req.eventRole;
    const globalRole = (req as any).user?.role;
    if (globalRole !== "ADMIN" && eventRole !== "ADMIN" && eventRole !== "ORGANIZER") {
      return res.status(403).json({ message: "Accesso non consentito" });
    }

    const metrics = await getDashboardMetrics(req.eventId!);
    return res.json(metrics);
  } catch (error) {
    return next(error);
  }
});

export default router;
