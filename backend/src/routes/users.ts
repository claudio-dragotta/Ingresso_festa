import { Router } from "express";
import { createUser, listUsers, deleteUser, setUserActive } from "../services/authService";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/auth";
import { adminOnly } from "../middleware/adminOnly";
import { UserRole } from "@prisma/client";

const router = Router();

// Solo admin può creare utenti
router.post("/", authenticate, adminOnly, async (req, res, next) => {
  try {
    const userRole = (req as any).user?.role;
    if (userRole !== "ADMIN") {
      return res.status(403).json({ message: "Solo admin può creare utenti" });
    }

    const { username, password, role } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: "Username e password sono obbligatori" });
    }

    const user = await createUser(username, password, (role as UserRole) || "ENTRANCE");
    return res.status(201).json({
      id: user.id,
      username: user.username,
      role: user.role,
      active: true,
    });
  } catch (error) {
    return next(error);
  }
});

// Solo admin può vedere la lista utenti
router.get("/", authenticate, adminOnly, async (req, res, next) => {
  try {
    const userRole = (req as any).user?.role;
    if (userRole !== "ADMIN") {
      return res.status(403).json({ message: "Solo admin può vedere gli utenti" });
    }

    const users = await listUsers();
    return res.json(users);
  } catch (error) {
    return next(error);
  }
});

// Solo admin può eliminare utenti
router.delete("/:id", authenticate, adminOnly, async (req, res, next) => {
  try {
    const userRole = (req as any).user?.role;
    if (userRole !== "ADMIN") {
      return res.status(403).json({ message: "Solo admin può eliminare utenti" });
    }

    await deleteUser(req.params.id);
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

// Attiva/Disattiva utente
router.patch("/:id", authenticate, adminOnly, async (req, res, next) => {
  try {
    const userRole = (req as any).user?.role;
    if (userRole !== "ADMIN") {
      return res.status(403).json({ message: "Solo admin può aggiornare utenti" });
    }

    const { active } = req.body as { active?: boolean };
    if (typeof active !== "boolean") {
      return res.status(400).json({ message: "Campo 'active' booleano richiesto" });
    }

    const user = await setUserActive(req.params.id, active);
    return res.json(user);
  } catch (error) {
    return next(error);
  }
});

// GET /users/:id/logs - Log di check-in per utente (solo admin)
router.get("/:id/logs", authenticate, adminOnly, async (req, res, next) => {
  try {
    const userRole = (req as any).user?.role;
    if (userRole !== "ADMIN") {
      return res.status(403).json({ message: "Solo admin può vedere i log utente" });
    }

    const userId = req.params.id;
    const logs = await prisma.checkInLog.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        invitee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            listType: true,
            paymentType: true,
          },
        },
      },
      take: 500,
    });

    const total = logs.length;
    const enteredCount = logs.filter(
      (l) => l.outcome === "SUCCESS" && (l.message?.includes("Ingresso autorizzato") ?? false)
    ).length;

    return res.json({ total, enteredCount, logs });
  } catch (error) {
    return next(error);
  }
});

// GET /users/:id/event-accesses - Feste a cui l'utente ha accesso (solo admin)
router.get("/:id/event-accesses", authenticate, adminOnly, async (req, res, next) => {
  try {
    const accesses = await prisma.userEventAccess.findMany({
      where: { userId: req.params.id },
      include: {
        event: { select: { id: true, name: true, date: true, status: true } },
      },
      orderBy: { event: { createdAt: "asc" } },
    });
    return res.json(accesses);
  } catch (error) {
    return next(error);
  }
});

export default router;
