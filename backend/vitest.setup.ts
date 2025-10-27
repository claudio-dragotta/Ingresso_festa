import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const projectRoot = __dirname;
const storageDir = path.resolve(projectRoot, "../storage");
const dataDir = path.resolve(storageDir, "data");
const qrDir = path.resolve(storageDir, "test-qrcodes");

fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(qrDir, { recursive: true });

const dbPath = path.resolve(dataDir, "test.db");
const dbUri = `file:${dbPath.replace(/\\/g, "/")}`;

process.env.NODE_ENV = "test";
process.env.JWT_SECRET ||= "test-secret";
process.env.ADMIN_USERNAME ||= "admin";
process.env.ADMIN_PASSWORD ||= "password";
process.env.FRONTEND_URL ||= "http://localhost:5173";
process.env.QR_OUTPUT_DIR = qrDir;
process.env.DATABASE_URL = dbUri;

if (!process.env.__TEST_DB_INITIALIZED__) {
  if (fs.existsSync(dbPath)) {
    fs.rmSync(dbPath);
  }

  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    cwd: projectRoot,
  });

  process.env.__TEST_DB_INITIALIZED__ = "true";
}
