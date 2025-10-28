import { Router } from "express";
import authRoutes from "./auth";
import inviteeRoutes from "./invitees";
import checkinRoutes from "./checkin";
import settingsRoutes from "./settings";
import dashboardRoutes from "./dashboard";
import syncRoutes from "./sync";
import healthRoutes from "./health";

const router = Router();

router.use("/auth", authRoutes);
router.use("/invitees", inviteeRoutes);
router.use("/checkin", checkinRoutes);
router.use("/settings", settingsRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/sync", syncRoutes);
router.use("/health", healthRoutes);

export default router;
