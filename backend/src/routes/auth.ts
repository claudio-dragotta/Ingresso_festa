import { Router } from "express";
import { login } from "../services/authService";

const router = Router();

router.post("/login", async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: "Username e password sono obbligatori" });
    }

    const token = await login(username, password);
    return res.json({ token });
  } catch (error) {
    return next(error);
  }
});

export default router;
