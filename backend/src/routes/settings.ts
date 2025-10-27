import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { getSystemConfig, updateSystemStatus } from "../services/systemService";

const router = Router();

router.use(authenticate);

router.get("/state", async (_req, res, next) => {
  try {
    const config = await getSystemConfig();
    return res.json(config);
  } catch (error) {
    return next(error);
  }
});

router.patch("/state", async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ message: "Stato richiesto" });
    }
    const updated = await updateSystemStatus(status);
    return res.json(updated);
  } catch (error) {
    return next(error);
  }
});

export default router;
