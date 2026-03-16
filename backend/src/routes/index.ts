import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireEventAccess } from "../middleware/eventAccess";
import authRoutes from "./auth";
import eventRoutes from "./events";
import inviteeRoutes from "./invitees";
import settingsRoutes from "./settings";
import dashboardRoutes from "./dashboard";
import syncRoutes from "./sync";
import healthRoutes from "./health";
import tshirtRoutes from "./tshirts";
import expenseRoutes from "./expenses";
import shuttlesRoutes from "./shuttles";
import usersRoutes from "./users";

const router = Router();

// Routes globali (non legate a una specifica festa)
router.use("/auth", authRoutes);
router.use("/events", eventRoutes);
router.use("/health", healthRoutes);
router.use("/users", usersRoutes);

// Routes per-evento: tutte montate sotto /events/:eventId/
// Il middleware requireEventAccess() verifica l'accesso e aggiunge req.eventId e req.eventRole
const eventRouter = Router({ mergeParams: true });
eventRouter.use(authenticate, requireEventAccess());

eventRouter.use("/invitees", inviteeRoutes);
eventRouter.use("/settings", settingsRoutes);
eventRouter.use("/dashboard", dashboardRoutes);
eventRouter.use("/sync", syncRoutes);
eventRouter.use("/tshirts", tshirtRoutes);
eventRouter.use("/expenses", expenseRoutes);
eventRouter.use("/shuttles", shuttlesRoutes);

router.use("/events/:eventId", eventRouter);

export default router;
