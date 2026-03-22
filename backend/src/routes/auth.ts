import { Router } from "express";
import { login, createUser, listUsers, deleteUser, setUserActive, changeOwnPassword } from "../services/authService";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/auth";
import { adminOnly } from "../middleware/adminOnly";
import { UserRole } from "@prisma/client";

const router = Router();

// POST /auth/change-password - Utente loggato cambia la propria password
router.post("/change-password", authenticate, async (req, res, next) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) return res.status(401).json({ message: "Non autenticato" });
    const { oldPassword, newPassword } = req.body as { oldPassword?: string; newPassword?: string };
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: "oldPassword e newPassword sono obbligatorie" });
    }
    await changeOwnPassword(userId, oldPassword, newPassword);
    return res.json({ message: "Password aggiornata con successo" });
  } catch (error) {
    return next(error);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: "Username e password sono obbligatori" });
    }

    const { token, role } = await login(username, password);
    return res.json({ token, role });
  } catch (error) {
    return next(error);
  }
});

// Solo admin può creare utenti
router.post("/users", authenticate, adminOnly, async (req, res, next) => {
  try {
    const userRole = (req as any).user?.role;
    if (userRole !== 'ADMIN') {
      return res.status(403).json({ message: "Solo admin può creare utenti" });
    }

    const { username, password, role } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: "Username e password sono obbligatori" });
    }

    const user = await createUser(username, password, role as UserRole || 'ENTRANCE');
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
router.get("/users", authenticate, adminOnly, async (req, res, next) => {
  try {
    const userRole = (req as any).user?.role;
    if (userRole !== 'ADMIN') {
      return res.status(403).json({ message: "Solo admin può vedere gli utenti" });
    }

    const users = await listUsers();
    return res.json(users);
  } catch (error) {
    return next(error);
  }
});

// Solo admin può eliminare utenti
router.delete("/users/:id", authenticate, adminOnly, async (req, res, next) => {
  try {
    const userRole = (req as any).user?.role;
    if (userRole !== 'ADMIN') {
      return res.status(403).json({ message: "Solo admin può eliminare utenti" });
    }

    await deleteUser(req.params.id);
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

export default router;

// Attiva/Disattiva utente
router.patch("/users/:id", authenticate, adminOnly, async (req, res, next) => {
  try {
    const userRole = (req as any).user?.role;
    if (userRole !== 'ADMIN') {
      return res.status(403).json({ message: "Solo admin può aggiornare utenti" });
    }

    const { active } = req.body as { active?: boolean };
    if (typeof active !== 'boolean') {
      return res.status(400).json({ message: "Campo 'active' booleano richiesto" });
    }

    const user = await setUserActive(req.params.id, active);
    return res.json(user);
  } catch (error) {
    return next(error);
  }
});

// GET /auth/users/:id/logs - Log di check-in per utente (solo admin)
router.get("/users/:id/logs", authenticate, adminOnly, async (req, res, next) => {
  try {
    const userRole = (req as any).user?.role;
    if (userRole !== 'ADMIN') {
      return res.status(403).json({ message: "Solo admin può vedere i log utente" });
    }

    const userId = req.params.id;
    const logs = await prisma.checkInLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        invitee: { select: { id: true, firstName: true, lastName: true, listType: true, paymentType: true } },
      },
      take: 500, // limite ragionevole per UI
    });

    const total = logs.length;
    const enteredCount = logs.filter(l => l.outcome === 'SUCCESS' && (l.message?.includes('Ingresso autorizzato') ?? false)).length;

    return res.json({ total, enteredCount, logs });
  } catch (error) {
    return next(error);
  }
});
