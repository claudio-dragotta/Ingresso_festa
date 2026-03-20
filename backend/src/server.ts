import http from "http";
import { createApp } from "./app";
import { config } from "./config";
import { logger } from "./logger";
import { startAutoSync } from "./services/syncService";

const start = async () => {
  try {
    const app = await createApp();
    const server = http.createServer(app);

    server.listen(config.port, config.host, () => {
      logger.info(`Server avviato su http://${config.host}:${config.port}`);

      // Avvia sincronizzazione automatica Google Sheets se abilitata.
      // Il Google Sheet ID è salvato per evento nel DB, non serve un ID globale.
      if (config.googleSheets.autoSyncEnabled) {
        logger.info(`Google Sheets auto-sync abilitato (ogni ${config.googleSheets.autoSyncIntervalMinutes} minuti)`);
        startAutoSync(config.googleSheets.autoSyncIntervalMinutes);
      } else {
        logger.info('Google Sheets auto-sync disabilitato (impostare GOOGLE_SHEETS_AUTO_SYNC=true per abilitarlo)');
      }
    });
  } catch (error) {
    logger.error("Errore di avvio", { error });
    process.exit(1);
  }
};

void start();
