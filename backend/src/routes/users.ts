import { Router } from "express";
import { createUser, listUsers, deleteUser, setUserActive, resetUserPassword, setUserRole } from "../services/authService";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/auth";
import { adminOnly } from "../middleware/adminOnly";
import { UserRole } from "@prisma/client";

const router = Router();

// Solo admin può creare utenti
router.post("/", authenticate, adminOnly, async (req, res, next) => {
  try {
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
    const users = await listUsers();
    return res.json(users);
  } catch (error) {
    return next(error);
  }
});

// Solo admin può eliminare utenti
router.delete("/:id", authenticate, adminOnly, async (req, res, next) => {
  try {
    await deleteUser(req.params.id);
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

// Attiva/Disattiva utente
router.patch("/:id", authenticate, adminOnly, async (req, res, next) => {
  try {
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

// PATCH /users/:id/role - Admin cambia il ruolo di un utente
router.patch("/:id/role", authenticate, adminOnly, async (req, res, next) => {
  try {
    const requesterId = (req as any).user?.userId;
    if (requesterId && requesterId === req.params.id) {
      return res.status(403).json({ message: "Non puoi cambiare il tuo stesso ruolo" });
    }
    const { role } = req.body as { role?: UserRole };
    const validRoles: UserRole[] = ["ADMIN", "ORGANIZER", "ENTRANCE", "SHUTTLE"];
    if (!role || !validRoles.includes(role)) {
      return res.status(400).json({ message: "Ruolo non valido" });
    }
    const user = await setUserRole(req.params.id, role);
    return res.json(user);
  } catch (error) {
    return next(error);
  }
});

// PATCH /users/:id/reset-password - Admin resetta la password di un utente
router.patch("/:id/reset-password", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { newPassword } = req.body as { newPassword?: string };
    if (!newPassword) return res.status(400).json({ message: "newPassword richiesta" });
    await resetUserPassword(req.params.id, newPassword);
    return res.json({ message: "Password resettata con successo" });
  } catch (error) {
    return next(error);
  }
});

// GET /users/:id/logs - Log di check-in per utente (solo admin)
router.get("/:id/logs", authenticate, adminOnly, async (req, res, next) => {
  try {
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
