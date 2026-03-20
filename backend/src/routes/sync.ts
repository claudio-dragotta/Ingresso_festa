import { Router, Response, NextFunction } from "express";
import { syncGoogleSheetToDatabase, isAutoSyncActive } from "../services/syncService";
import { syncTshirtsFromGoogleSheets } from "../services/tshirtService";
import { testGoogleSheetsConnection } from "../services/googleSheetsService";
import { adminOnly } from "../middleware/adminOnly";
import { logger } from "../logger";
import { prisma } from "../lib/prisma";
import { EventRequest } from "../middleware/eventAccess";

const router = Router();

/**
 * POST /sync/google-sheets
 *
 * Sincronizzazione manuale da Google Sheets
 * Legge il foglio configurato e importa nuove persone
 */
router.post(
  "/google-sheets",
  adminOnly,
  async (req: EventRequest, res: Response, next: NextFunction) => {
    try {
      logger.info("🔄 Richiesta sincronizzazione manuale Google Sheets");

      const pruneMissing = Boolean((req.body as any)?.pruneMissing);
      const result = await syncGoogleSheetToDatabase(req.eventId!, { pruneMissing });

      res.json({
        success: result.success,
        message: result.success
          ? `Sincronizzazione completata: ${result.newImported} nuovi importati, ${result.alreadyExists} già presenti`
          : "Sincronizzazione fallita",
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
 * GET /sync/status
 *
 * Verifica stato sincronizzazione automatica
 */
router.get(
  "/status",
  adminOnly,
  async (req: EventRequest, res: Response, next: NextFunction) => {
    try {
      const autoSyncActive = isAutoSyncActive();

      res.json({
        autoSyncEnabled: autoSyncActive,
        message: autoSyncActive
          ? "Sincronizzazione automatica attiva"
          : "Sincronizzazione automatica non attiva",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /sync/test-connection
 *
 * Test connessione a Google Sheets (diagnostica)
 */
router.get(
  "/test-connection",
  adminOnly,
  async (req: EventRequest, res: Response, next: NextFunction) => {
    try {
      logger.info("🧪 Test connessione Google Sheets");

      const ev = await prisma.event.findUnique({ where: { id: req.eventId }, select: { googleSheetId: true } });
      const connected = await testGoogleSheetsConnection(ev?.googleSheetId ?? undefined);

      res.json({
        success: connected,
        message: connected
          ? "Connessione Google Sheets OK"
          : "Impossibile connettersi a Google Sheets - controlla configurazione",
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /sync/reset-and-reimport - Admin only
router.post(
  "/reset-and-reimport",
  adminOnly,
  async (req: EventRequest, res: Response, next: NextFunction) => {
    try {
      logger.warn("⚠️ Reset INVITATI + LOG + TSHIRTS e reimport da Google Sheets");
      const eventId = req.eventId!;
      const deletedLogs = await prisma.checkInLog.deleteMany({ where: { eventId } });
      const deletedInvitees = await prisma.invitee.deleteMany({ where: { eventId } });
      const deletedTshirts = await prisma.tshirt.deleteMany({ where: { eventId } });
      const peopleImport = await syncGoogleSheetToDatabase(eventId);
      const tshirtImport = await syncTshirtsFromGoogleSheets(eventId);
      return res.json({
        reset: {
          deletedInvitees: deletedInvitees.count,
          deletedLogs: deletedLogs.count,
          deletedTshirts: deletedTshirts.count,
        },
        import: peopleImport,
        tshirts: tshirtImport,
      });
    } catch (error) {
      return next(error);
    }
  }
);

export default router;
