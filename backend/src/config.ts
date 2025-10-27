import path from "path";
import dotenv from "dotenv";

const envFile = process.env.NODE_ENV === "production" ? ".env" : ".env.local";
dotenv.config({
  path: [
    path.resolve(process.cwd(), envFile),
    path.resolve(process.cwd(), ".env"),
  ],
});

const required = (value: string | undefined, key: string): string => {
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

export const config = {
  env: process.env.NODE_ENV ?? "development",
  isProduction: process.env.NODE_ENV === "production",
  port: Number(process.env.PORT ?? 8000),
  host: process.env.HOST ?? "0.0.0.0",
  frontendUrl: process.env.FRONTEND_URL,
  databaseUrl: required(process.env.DATABASE_URL, "DATABASE_URL"),
  jwtSecret: required(process.env.JWT_SECRET, "JWT_SECRET"),
  adminUsername: required(process.env.ADMIN_USERNAME, "ADMIN_USERNAME"),
  adminPassword: required(process.env.ADMIN_PASSWORD, "ADMIN_PASSWORD"),
  qrOutputDir: process.env.QR_OUTPUT_DIR ?? path.resolve(process.cwd(), "../storage/qrcodes"),
  email: {
    from: process.env.EMAIL_FROM ?? "noreply@example.com",
    transportUrl: process.env.EMAIL_TRANSPORT_URL,
  },
};

export const eventDomain = process.env.EVENT_DOMAIN ?? "https://example.com";
