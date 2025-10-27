import { Router, Request, Response, NextFunction } from 'express';
import { syncGoogleSheetToDatabase, isAutoSyncActive } from '../services/syncService';
import { testGoogleSheetsConnection } from '../services/googleSheetsService';
import { authenticate } from '../middleware/auth';
import { logger } from '../logger';

const router = Router();

/**
 * POST /api/sync/google-sheets
 *
 * Sincronizzazione manuale da Google Sheets
 * Legge il foglio configurato e importa nuove persone
 */
router.post(
  '/google-sheets',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      logger.info('🔄 Richiesta sincronizzazione manuale Google Sheets');

      const result = await syncGoogleSheetToDatabase();

      res.json({
        success: result.success,
        message: result.success
          ? `Sincronizzazione completata: ${result.newImported} nuovi importati, ${result.alreadyExists} già presenti`
          : 'Sincronizzazione fallita',
        data: {
          totalFromSheet: result.totalFromSheet,
          newImported: result.newImported,
          alreadyExists: result.alreadyExists,
          errors: result.errors,
          duration: result.duration,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/sync/status
 *
 * Verifica stato sincronizzazione automatica
 */
router.get(
  '/status',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const autoSyncActive = isAutoSyncActive();

      res.json({
        autoSyncEnabled: autoSyncActive,
        message: autoSyncActive
          ? 'Sincronizzazione automatica attiva'
          : 'Sincronizzazione automatica non attiva',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/sync/test-connection
 *
 * Test connessione a Google Sheets (diagnostica)
 */
router.get(
  '/test-connection',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      logger.info('🧪 Test connessione Google Sheets');

      const connected = await testGoogleSheetsConnection();

      res.json({
        success: connected,
        message: connected
          ? 'Connessione Google Sheets OK'
          : 'Impossibile connettersi a Google Sheets - controlla configurazione',
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
