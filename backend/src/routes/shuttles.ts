import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { adminOrOrganizerOnly, shuttleWrite, shuttleAccess } from "../middleware/roles";
import { config } from "../config";
import {
  listMachines,
  createMachine,
  updateMachine,
  deleteMachine,
  listSlots,
  listAssignments,
  createAssignment,
  updateAssignmentStatus,
  deleteAssignment,
} from "../services/shuttleService";
import { ShuttleBoardStatus, ShuttleDirection } from "@prisma/client";

const router = Router();

// All routes authenticated
router.use(authenticate);
router.use(shuttleAccess);

// GET /api/shuttles/config
router.get("/config", async (req, res, next) => {
  try {
    const machines = await listMachines();
    res.json({
      machines,
      slotCapacity: config.shuttle.slotCapacity,
      machineCapacity: config.shuttle.machineCapacity,
      outbound: config.shuttle.outbound,
      return: config.shuttle.return,
      stepMinutes: config.shuttle.stepMinutes,
    });
  } catch (e) { next(e); }
});

// Machines
router.get("/machines", async (_req, res, next) => {
  try { res.json(await listMachines()); } catch (e) { next(e); }
});
router.post("/machines", adminOrOrganizerOnly, async (req, res, next) => {
  try {
    const { name, color } = req.body as { name?: string; color?: string };
    const m = await createMachine(name ?? "", color);
    res.status(201).json(m);
  } catch (e) { next(e); }
});
router.patch("/machines/:id", adminOrOrganizerOnly, async (req, res, next) => {
  try {
    const { id } = req.params;
    const m = await updateMachine(id, req.body as any);
    res.json(m);
  } catch (e) { next(e); }
});
router.delete("/machines/:id", adminOrOrganizerOnly, async (req, res, next) => {
  try {
    const { id } = req.params;
    await deleteMachine(id);
    res.status(204).send();
  } catch (e) { next(e); }
});

// Slots
router.get("/slots", async (req, res, next): Promise<void> => {
  try {
    const direction = (req.query.direction as ShuttleDirection) ?? "ANDATA";
    if (direction !== "ANDATA" && direction !== "RITORNO") { res.status(400).json({ message: "Direzione non valida" }); return; }
    const slots = await listSlots(direction);
    res.json(slots);
  } catch (e) { next(e); }
});

// Assignments
router.get("/assignments", async (req, res, next): Promise<void> => {
  try {
    const direction = req.query.direction as ShuttleDirection | undefined;
    const time = req.query.time as string | undefined;
    const machineId = req.query.machineId as string | undefined;
    if (direction && direction !== "ANDATA" && direction !== "RITORNO") { res.status(400).json({ message: "Direzione non valida" }); return; }
    const list = await listAssignments({ direction, time, machineId });
    res.json(list);
  } catch (e) { next(e); }
});

// Creazione assegnazioni: solo Admin o Organizzatore
router.post("/assignments", adminOrOrganizerOnly, async (req, res, next) => {
  try {
    const { direction, time, machineId, inviteeId, fullName } = req.body as {
      direction: ShuttleDirection; time: string; machineId: string; inviteeId?: string; fullName?: string;
    };
    const created = await createAssignment({ direction, time, machineId, inviteeId, fullName });
    res.status(201).json(created);
  } catch (e) { next(e); }
});

router.patch("/assignments/:id", shuttleWrite, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body as { status: ShuttleBoardStatus };
    const userId = (req as any).user?.userId as string | undefined;
    const updated = await updateAssignmentStatus(id, status, userId);
    res.json(updated);
  } catch (e) { next(e); }
});

router.delete("/assignments/:id", adminOrOrganizerOnly, async (req, res, next) => {
  try {
    const { id } = req.params;
    await deleteAssignment(id);
    res.status(204).send();
  } catch (e) { next(e); }
});

export default router;
