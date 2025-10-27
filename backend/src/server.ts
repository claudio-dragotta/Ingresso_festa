import http from "http";
import { createApp } from "./app";
import { config } from "./config";
import { logger } from "./logger";

const start = async () => {
  try {
    const app = await createApp();
    const server = http.createServer(app);

    server.listen(config.port, config.host, () => {
      logger.info(`Server avviato su http://${config.host}:${config.port}`);
    });
  } catch (error) {
    logger.error("Errore di avvio", { error });
    process.exit(1);
  }
};

void start();
