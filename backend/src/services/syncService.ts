import { logger } from '../logger';
import { fetchAndParseGoogleSheet, ParsedPerson } from './googleSheetsService';
import { createInvitee } from './inviteeService';
import { prisma } from '../lib/prisma';

/**
 * Sync Service
 *
 * Gestisce la sincronizzazione automatica tra Google Sheets e database locale.
 * Importa nuove persone e crea automaticamente QR codes.
 */

export interface SyncResult {
  success: boolean;
  totalFromSheet: number;
  newImported: number;
  alreadyExists: number;
  errors: string[];
  duration: number; // millisecondi
}

/**
 * Sincronizza Google Sheet con il database
 * - Legge tutte le persone dal foglio
 * - Controlla se esistono già nel database (per nome+cognome)
 * - Crea nuovi invitati con QR code per chi non esiste
 *
 * @returns Risultato dettagliato della sincronizzazione
 */
export async function syncGoogleSheetToDatabase(): Promise<SyncResult> {
  const startTime = Date.now();

  logger.info('🔄 Avvio sincronizzazione Google Sheets...');

  const result: SyncResult = {
    success: false,
    totalFromSheet: 0,
    newImported: 0,
    alreadyExists: 0,
    errors: [],
    duration: 0,
  };

  try {
    // 1. Leggi e parsa il foglio Google
    const persons = await fetchAndParseGoogleSheet();
    result.totalFromSheet = persons.length;

    if (persons.length === 0) {
      logger.warn('Nessuna persona trovata nel Google Sheet');
      result.success = true;
      result.duration = Date.now() - startTime;
      return result;
    }

    logger.info(`📋 Trovate ${persons.length} persone nel foglio Google`);

    // 2. Per ogni persona, verifica se esiste già e importa se nuova
    for (const person of persons) {
      try {
        const imported = await importPersonIfNotExists(person);

        if (imported) {
          result.newImported++;
          logger.info(`✅ Importato: ${person.lastName} ${person.firstName}`);
        } else {
          result.alreadyExists++;
          logger.debug(`⏭️  Già presente: ${person.lastName} ${person.firstName}`);
        }
      } catch (error: any) {
        const errorMsg = `Errore importando "${person.originalValue}": ${error.message}`;
        result.errors.push(errorMsg);
        logger.error(errorMsg);
      }
    }

    result.success = result.errors.length === 0 || result.newImported > 0;
    result.duration = Date.now() - startTime;

    logger.info(
      `✅ Sincronizzazione completata: ${result.newImported} nuovi, ` +
      `${result.alreadyExists} già presenti, ${result.errors.length} errori ` +
      `(${result.duration}ms)`
    );

    return result;

  } catch (error: any) {
    logger.error('❌ Errore sincronizzazione Google Sheets:', error);
    result.errors.push(error.message);
    result.duration = Date.now() - startTime;
    return result;
  }
}

/**
 * Importa una persona se non esiste già nel database
 * Controllo duplicati: firstName + lastName (case-insensitive)
 *
 * @returns true se importato, false se già esistente
 */
async function importPersonIfNotExists(person: ParsedPerson): Promise<boolean> {
  const { firstName, lastName } = person;

  // Cerca se esiste già (controllo case-insensitive manuale)
  // SQLite non supporta mode: 'insensitive', quindi recuperiamo tutti e filtriamo in memoria
  const allInvitees = await prisma.invitee.findMany({
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
  });

  const existing = allInvitees.find(
    (inv) =>
      inv.firstName.toLowerCase() === firstName.trim().toLowerCase() &&
      inv.lastName.toLowerCase() === lastName.trim().toLowerCase()
  );

  if (existing) {
    return false; // Già presente
  }

  // Non esiste -> crea nuovo invitato con QR code
  await createInvitee({
    firstName: firstName || 'Nome', // Fallback se firstName vuoto
    lastName,
    email: undefined,
    phone: undefined,
  });

  return true; // Importato
}

/**
 * Timer per sincronizzazione automatica periodica
 */
let syncIntervalId: NodeJS.Timeout | null = null;

/**
 * Avvia la sincronizzazione automatica periodica
 * @param intervalMinutes Intervallo in minuti (default: 10)
 */
export function startAutoSync(intervalMinutes: number = 10): void {
  if (syncIntervalId) {
    logger.warn('Auto-sync già attivo, non avvio duplicato');
    return;
  }

  const intervalMs = intervalMinutes * 60 * 1000;

  logger.info(`🚀 Avvio auto-sync Google Sheets ogni ${intervalMinutes} minuti`);

  // Prima sincronizzazione immediata
  syncGoogleSheetToDatabase().catch(error => {
    logger.error('Errore prima sincronizzazione:', error);
  });

  // Poi ogni X minuti
  syncIntervalId = setInterval(() => {
    syncGoogleSheetToDatabase().catch(error => {
      logger.error('Errore sincronizzazione automatica:', error);
    });
  }, intervalMs);
}

/**
 * Ferma la sincronizzazione automatica
 */
export function stopAutoSync(): void {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
    logger.info('🛑 Auto-sync Google Sheets fermato');
  }
}

/**
 * Verifica se l'auto-sync è attivo
 */
export function isAutoSyncActive(): boolean {
  return syncIntervalId !== null;
}
