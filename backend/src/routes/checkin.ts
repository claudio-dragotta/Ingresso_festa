import { Router } from "express";
import { markCheckIn } from "../services/inviteeService";
import { authenticate } from "../middleware/auth";

const router = Router();

router.use(authenticate);

router.post("/", async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ message: "Token mancante" });
    }

    const invitee = await markCheckIn(token);
    return res.json({
      invitee,
      message: `Benvenuto ${invitee.firstName} ${invitee.lastName}!`,
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
