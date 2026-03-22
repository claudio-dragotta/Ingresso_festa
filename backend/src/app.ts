import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { config } from "./config";
import { AppError } from "./utils/errors";
import { logger } from "./logger";
import { ensureSystemConfig } from "./services/systemService";
import { ensureDefaultAdmin } from "./services/authService";
import { sqlInjectionProtection } from "./middleware/sqlInjectionProtection";
import router from "./routes";
export const createApp = async () => {
  await ensureSystemConfig();
  await ensureDefaultAdmin();
  // ensureShuttleSetup is now per-event and called when an event is accessed

  const app = express();

  const allowedOrigin =
    Array.isArray(config.frontendOrigins) &&
    config.frontendOrigins.length > 0 &&
    !config.frontendOrigins.includes("*")
      ? config.frontendOrigins
      : false; // Nessun origin accettato se FRONTEND_URL non è configurato

  app.use(
    cors({
      origin: allowedOrigin,
      credentials: true,
    }),
  );
  app.use(helmet());
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan("tiny"));

  // SQL Injection Protection Layer
  app.use("/api/", sqlInjectionProtection);

  app.use("/api", router);

  app.use((req, res) => {
    res.status(404).json({ message: "Endpoint non trovato" });
  });

  app.use(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
      if (err instanceof AppError) {
        logger.warn("Handled error", { message: err.message, status: err.statusCode });
        return res.status(err.statusCode).json({ message: err.message, context: err.context });
      }

      logger.error("Unexpected error", { message: err.message });
      return res.status(500).json({ message: "Errore interno" });
    },
  );

  return app;
};
