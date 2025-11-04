import { Router, Request, Response, NextFunction } from 'express';
import { syncGoogleSheetToDatabase, isAutoSyncActive } from '../services/syncService';
import { syncTshirtsFromGoogleSheets } from '../services/tshirtService';
import { testGoogleSheetsConnection } from '../services/googleSheetsService';
import { authenticate } from '../middleware/auth';
import { adminOnly } from '../middleware/adminOnly';
import { logger } from '../logger';
import { prisma } from '../lib/prisma';

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
  adminOnly,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      logger.info('🔄 Richiesta sincronizzazione manuale Google Sheets');

      const pruneMissing = Boolean((req.body as any)?.pruneMissing);
      const result = await syncGoogleSheetToDatabase({ pruneMissing });

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
          breakdown: result.breakdown,
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
  adminOnly,
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
  adminOnly,
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

// POST /api/sync/reset-and-reimport - Admin only
router.post(
  '/reset-and-reimport',
  authenticate,
  adminOnly,
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      logger.warn('⚠️ Reset INVITATI + LOG + TSHIRTS e reimport da Google Sheets');
      const deletedLogs = await prisma.checkInLog.deleteMany({});
      const deletedInvitees = await prisma.invitee.deleteMany({});
      const deletedTshirts = await prisma.tshirt.deleteMany({});
      const peopleImport = await syncGoogleSheetToDatabase();
      const tshirtImport = await syncTshirtsFromGoogleSheets();
      return res.json({
        reset: { deletedInvitees: deletedInvitees.count, deletedLogs: deletedLogs.count, deletedTshirts: deletedTshirts.count },
        import: peopleImport,
        tshirts: tshirtImport,
      });
    } catch (error) {
      return next(error);
    }
  }
);
