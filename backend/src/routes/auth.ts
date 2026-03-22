import { Router } from "express";
import rateLimit from "express-rate-limit";
import { login, changeOwnPassword } from "../services/authService";
import { authenticate } from "../middleware/auth";

const router = Router();

// Max 15 tentativi di login per IP ogni 15 minuti
const loginRateLimit = rateLimit({
  windowMs: 15 * 60_000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Troppi tentativi di accesso. Riprova tra 15 minuti." },
});

// POST /auth/login
router.post("/login", loginRateLimit, async (req, res, next) => {
  try {
    const { username, password } = req.body ?? {};
    if (typeof username !== "string" || typeof password !== "string" || !username || !password) {
      return res.status(400).json({ message: "Username e password sono obbligatori" });
    }

    const { token, role } = await login(username, password);
    return res.json({ token, role });
  } catch (error) {
    return next(error);
  }
});

// POST /auth/change-password — utente loggato cambia la propria password
router.post("/change-password", authenticate, async (req, res, next) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) return res.status(401).json({ message: "Non autenticato" });

    const { oldPassword, newPassword } = req.body ?? {};
    if (typeof oldPassword !== "string" || typeof newPassword !== "string" || !oldPassword || !newPassword) {
      return res.status(400).json({ message: "oldPassword e newPassword sono obbligatorie" });
    }

    await changeOwnPassword(userId, oldPassword, newPassword);
    return res.json({ message: "Password aggiornata con successo" });
  } catch (error) {
    return next(error);
  }
});

export default router;
