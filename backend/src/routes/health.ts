import { Router } from "express";
import { prisma } from "../lib/prisma";
import { config } from "../config";

const router = Router();

router.get("/", async (_req, res) => {
  // Basic DB check
  let dbOk = true;
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbOk = false;
  }

  res.json({
    status: "ok",
    db: dbOk ? "ok" : "error",
    env: config.env,
  });
});

export default router;

