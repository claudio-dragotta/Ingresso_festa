import { Router } from "express";
import { login, createUser, listUsers, deleteUser, setUserActive } from "../services/authService";
import { authenticate } from "../middleware/auth";
import { adminOnly } from "../middleware/adminOnly";
import { UserRole } from "@prisma/client";

const router = Router();

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
