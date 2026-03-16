import { Router } from "express";
import {
  fetchTshirts,
  fetchTshirtsForEntrance,
  fetchTshirtStats,
  createTshirt,
  toggleTshirtReceived,
  deleteTshirt,
  searchTshirts,
  searchTshirtsForEntrance,
  syncTshirtsFromGoogleSheets,
  writeTshirtToSheets,
  updateTshirt,
  type TshirtInput,
} from "../services/tshirtService";
import { allowRoles } from "../middleware/roles";
import { adminOnly } from "../middleware/adminOnly";
import { EventRequest } from "../middleware/eventAccess";

const router = Router();

// GET /tshirts - Ottieni lista magliette (Admin: tutte, Entrance: solo PR e Vincitore)
router.get("/", allowRoles(["ADMIN", "ORGANIZER", "ENTRANCE"]), async (req: EventRequest, res, next) => {
  try {
    const userRole = (req as any).user?.role;
    const query = req.query.search as string | undefined;

    if (query && query.length >= 2) {
      // Ricerca
      const results = (userRole === "ADMIN" || userRole === "ORGANIZER")
        ? await searchTshirts(query, req.eventId!)
        : await searchTshirtsForEntrance(query, req.eventId!);
      return res.json(results);
    }

    // Lista completa
    if (userRole === "ADMIN" || userRole === "ORGANIZER") {
      const tshirts = await fetchTshirts(req.eventId!);
      return res.json(tshirts);
    }

    // Per utenti ENTRANCE e SHUTTLE, restituisci solo magliette PR e Vincenti
    const tshirtsForEntrance = await fetchTshirtsForEntrance(req.eventId!);
    return res.json(tshirtsForEntrance);
  } catch (error) {
    return next(error);
  }
});

// GET /tshirts/stats - Statistiche magliette (solo admin)
router.get("/stats", adminOnly, async (req: EventRequest, res, next) => {
  try {
    const stats = await fetchTshirtStats(req.eventId!);
    return res.json(stats);
  } catch (error) {
    return next(error);
  }
});

// POST /tshirts - Crea nuova maglietta (solo admin)
router.post("/", adminOnly, async (req: EventRequest, res, next) => {
  try {
    const data: TshirtInput = req.body;

    if (!data.firstName || !data.lastName || !data.size) {
      return res.status(400).json({ message: "Nome, cognome e taglia sono obbligatori" });
    }

    const tshirt = await createTshirt(data, req.eventId!);
    return res.status(201).json(tshirt);
  } catch (error) {
    return next(error);
  }
});

// PATCH /tshirts/:id/toggle - Toggle consegna maglietta
// Toggle consegna: Admin, Organizer, Entrance
router.patch("/:id/toggle", allowRoles(["ADMIN", "ORGANIZER", "ENTRANCE"]), async (req: EventRequest, res, next) => {
  try {
    const tshirt = await toggleTshirtReceived(req.params.id);
    return res.json(tshirt);
  } catch (error) {
    return next(error);
  }
});

// DELETE /tshirts/:id - Elimina maglietta (solo admin)
router.delete("/:id", adminOnly, async (req: EventRequest, res, next) => {
  try {
    await deleteTshirt(req.params.id);
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

// PATCH /tshirts/:id - Aggiorna taglia e/o tipologia (solo admin)
router.patch("/:id", adminOnly, async (req: EventRequest, res, next) => {
  try {
    const { size, type } = req.body as { size?: string; type?: string };
    if (!size && typeof type !== "string") {
      return res.status(400).json({ message: "Nessun campo da aggiornare" });
    }
    const tshirt = await updateTshirt(req.params.id, { size, type });
    return res.json(tshirt);
  } catch (error) {
    return next(error);
  }
});

// POST /tshirts/sync - Sincronizza magliette da Google Sheets (solo admin)
router.post("/sync", adminOnly, async (req: EventRequest, res, next) => {
  try {
    const pruneMissing = Boolean((req.body as any)?.pruneMissing);
    const result = await syncTshirtsFromGoogleSheets(req.eventId!, { pruneMissing });
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

export default router;
