import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { adminOnly } from "../middleware/adminOnly";
import { getDashboardMetrics } from "../services/systemService";

const router = Router();

router.use(authenticate, adminOnly);

router.get("/metrics", async (_req, res, next) => {
  try {
    const metrics = await getDashboardMetrics();
    return res.json(metrics);
  } catch (error) {
    return next(error);
  }
});

export default router;
