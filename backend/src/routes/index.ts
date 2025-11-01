import { Router } from "express";
import authRoutes from "./auth";
import inviteeRoutes from "./invitees";
import settingsRoutes from "./settings";
import dashboardRoutes from "./dashboard";
import syncRoutes from "./sync";
import healthRoutes from "./health";
import tshirtRoutes from "./tshirts";
import expenseRoutes from "./expenses";

const router = Router();

router.use("/auth", authRoutes);
router.use("/invitees", inviteeRoutes);
router.use("/settings", settingsRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/sync", syncRoutes);
router.use("/health", healthRoutes);
router.use("/tshirts", tshirtRoutes);
router.use("/expenses", expenseRoutes);

export default router;
