import { Router } from "express";
import { login, createUser, listUsers, deleteUser } from "../services/authService";
import { authenticate } from "../middleware/auth";
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
router.post("/users", authenticate, async (req, res, next) => {
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
    });
  } catch (error) {
    return next(error);
  }
});

// Solo admin può vedere la lista utenti
router.get("/users", authenticate, async (req, res, next) => {
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
router.delete("/users/:id", authenticate, async (req, res, next) => {
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
