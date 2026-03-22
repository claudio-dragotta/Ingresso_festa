import { Router } from "express";
import { prisma } from "../lib/prisma";
import { config } from "../config";

const router = Router();

// GET /health/live — liveness: il processo è vivo?
router.get("/live", (_req, res) => {
  res.json({ status: "ok" });
});

// GET /health/ready — readiness: il servizio è pronto a ricevere traffico?
router.get("/ready", async (_req, res) => {
  let dbOk = true;
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbOk = false;
  }

  const status = dbOk ? "ok" : "degraded";
  res.status(dbOk ? 200 : 503).json({
    status,
    db: dbOk ? "ok" : "error",
    env: config.env,
  });
});

// GET /health — retrocompatibilità: reindirizza alla readiness
router.get("/", async (_req, res) => {
  let dbOk = true;
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbOk = false;
  }

  res.status(dbOk ? 200 : 503).json({
    status: dbOk ? "ok" : "degraded",
    db: dbOk ? "ok" : "error",
    env: config.env,
  });
});

export default router;
