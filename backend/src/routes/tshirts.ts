import { Router } from "express";
import {
  fetchTshirts,
  fetchTshirtStats,
  createTshirt,
  toggleTshirtReceived,
  deleteTshirt,
  searchTshirts,
  searchTshirtsForEntrance,
  syncTshirtsFromGoogleSheets,
  writeTshirtToSheets,
  updateTshirt,
  type TshirtInput
} from "../services/tshirtService";
import { authenticate } from "../middleware/auth";
import { allowRoles } from "../middleware/roles";
import { adminOnly } from "../middleware/adminOnly";

const router = Router();

// GET /api/tshirts - Ottieni lista magliette (Admin: tutte, Entrance: solo PR e Vincitore)
router.get("/", authenticate, async (req, res, next) => {
  try {
    const userRole = (req as any).user?.role;
    const query = req.query.search as string | undefined;

    if (query && query.length >= 2) {
      // Ricerca
      const results = userRole === 'ADMIN'
        ? await searchTshirts(query)
        : await searchTshirtsForEntrance(query);
      return res.json(results);
    }

    // Lista completa solo per admin
    if (userRole === 'ADMIN') {
      const tshirts = await fetchTshirts();
      return res.json(tshirts);
    }

    // Per utenti ENTRANCE, restituisci lista vuota (usano solo ricerca)
    return res.json([]);
  } catch (error) {
    return next(error);
  }
});

// GET /api/tshirts/stats - Statistiche magliette (solo admin)
router.get("/stats", authenticate, adminOnly, async (req, res, next) => {
  try {
    const stats = await fetchTshirtStats();
    return res.json(stats);
  } catch (error) {
    return next(error);
  }
});

// POST /api/tshirts - Crea nuova maglietta (solo admin)
router.post("/", authenticate, adminOnly, async (req, res, next) => {
  try {
    const data: TshirtInput = req.body;

    if (!data.firstName || !data.lastName || !data.size) {
      return res.status(400).json({ message: "Nome, cognome e taglia sono obbligatori" });
    }

    const tshirt = await createTshirt(data);
    return res.status(201).json(tshirt);
  } catch (error) {
    return next(error);
  }
});

// PATCH /api/tshirts/:id/toggle - Toggle consegna maglietta
// Toggle consegna: Admin, Organizer, Entrance
router.patch("/:id/toggle", authenticate, allowRoles(['ADMIN','ORGANIZER','ENTRANCE']), async (req, res, next) => {
  try {
    const tshirt = await toggleTshirtReceived(req.params.id);
    return res.json(tshirt);
  } catch (error) {
    return next(error);
  }
});

// DELETE /api/tshirts/:id - Elimina maglietta (solo admin)
router.delete("/:id", authenticate, adminOnly, async (req, res, next) => {
  try {
    await deleteTshirt(req.params.id);
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

// PATCH /api/tshirts/:id - Aggiorna taglia e/o tipologia (solo admin)
router.patch("/:id", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { size, type } = req.body as { size?: string; type?: string };
    if (!size && typeof type !== 'string') {
      return res.status(400).json({ message: "Nessun campo da aggiornare" });
    }
    const tshirt = await updateTshirt(req.params.id, { size, type });
    return res.json(tshirt);
  } catch (error) {
    return next(error);
  }
});

// POST /api/tshirts/sync - Sincronizza magliette da Google Sheets (solo admin)
router.post("/sync", authenticate, adminOnly, async (req, res, next) => {
  try {
    const pruneMissing = Boolean((req.body as any)?.pruneMissing);
    const result = await syncTshirtsFromGoogleSheets({ pruneMissing });
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

export default router;
