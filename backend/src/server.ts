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

      // Avvia sincronizzazione automatica Google Sheets se abilitata
      if (config.googleSheets.autoSyncEnabled && config.googleSheets.spreadsheetId) {
        logger.info('Google Sheets auto-sync abilitato');
        startAutoSync(config.googleSheets.autoSyncIntervalMinutes);
      } else {
        logger.info('Google Sheets auto-sync disabilitato (configurare GOOGLE_SHEET_ID e GOOGLE_SHEETS_AUTO_SYNC=true)');
      }
    });
  } catch (error) {
    logger.error("Errore di avvio", { error });
    process.exit(1);
  }
};

void start();
