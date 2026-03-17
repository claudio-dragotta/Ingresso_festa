import { logger } from "../logger";
import { fetchAndParseGoogleSheets, ParsedPerson } from "./googleSheetsService";
import { syncTshirtsFromGoogleSheets } from "./tshirtService";
import { ListType } from "@prisma/client";
import { prisma } from "../lib/prisma";

/**
 * Sync Service
 *
 * Gestisce la sincronizzazione automatica tra Google Sheets e database locale.
 * Supporta due liste: PAGANTI (con tipologia pagamento) e GREEN.
 */

export interface SyncResult {
  success: boolean;
  totalFromSheet: number;
  newImported: number;
  alreadyExists: number;
  errors: string[];
  duration: number; // millisecondi
  breakdown: {
    paganti: { imported: number; exists: number };
    green: { imported: number; exists: number };
  };
}

/**
 * Sincronizza entrambi i Google Sheets (PAGANTI e GREEN) con il database
 * - Legge tutte le persone dai fogli
 * - Controlla se esistono già nel database (per nome+cognome nell'evento)
 * - Crea nuovi invitati per chi non esiste
 *
 * @param eventId ID dell'evento per cui sincronizzare
 * @param options Opzioni di sincronizzazione
 * @returns Risultato dettagliato della sincronizzazione
 */
export async function syncGoogleSheetToDatabase(eventId: string, options?: { pruneMissing?: boolean }): Promise<SyncResult> {
  const startTime = Date.now();

  logger.info("🔄 Avvio sincronizzazione Google Sheets (PAGANTI + GREEN)...");

  const result: SyncResult = {
    success: false,
    totalFromSheet: 0,
    newImported: 0,
    alreadyExists: 0,
    errors: [],
    duration: 0,
    breakdown: {
      paganti: { imported: 0, exists: 0 },
      green: { imported: 0, exists: 0 },
    },
  };

  try {
    // 1. Recupera il googleSheetId dell'evento — se non configurato, salta la sincronizzazione
    const event = await prisma.event.findUnique({ where: { id: eventId }, select: { googleSheetId: true } });
    if (!event?.googleSheetId) {
      logger.info(`Evento ${eventId} senza Google Sheet configurato — sincronizzazione saltata`);
      result.success = true;
      result.duration = Date.now() - startTime;
      return result;
    }

    // 2. Leggi e parsa entrambi i fogli Google dell'evento
    const persons = await fetchAndParseGoogleSheets(event.googleSheetId);
    result.totalFromSheet = persons.length;

    if (persons.length === 0) {
      logger.warn("Nessuna persona trovata nei Google Sheets");
      result.success = true;
      result.duration = Date.now() - startTime;
      return result;
    }

    const pagantiCount = persons.filter(p => p.listType === "PAGANTE").length;
    const greenCount = persons.filter(p => p.listType === "GREEN").length;
    logger.info(`📋 Trovate ${persons.length} persone (${pagantiCount} PAGANTI, ${greenCount} GREEN)`);

    // 2. Per ogni persona, verifica se esiste già e importa se nuova
    const sheetKeys = new Set<string>();
    const norm = (s: string) => s
      .normalize("NFC")
      .replace(/\u00A0/g, " ") // NBSP -> space
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
    const makeKey = (fn: string, ln: string) => `${norm(ln)}|${norm(fn)}`;

    for (const person of persons) {
      try {
        sheetKeys.add(makeKey(person.firstName, person.lastName));
        const imported = await importPersonIfNotExists(person, eventId);

        if (imported) {
          result.newImported++;
          if (person.listType === "PAGANTE") {
            result.breakdown.paganti.imported++;
          } else {
            result.breakdown.green.imported++;
          }
          logger.info(`✅ Importato ${person.listType}: ${person.lastName} ${person.firstName}`);
        } else {
          result.alreadyExists++;
          if (person.listType === "PAGANTE") {
            result.breakdown.paganti.exists++;
          } else {
            result.breakdown.green.exists++;
          }
          logger.debug(`⏭️  Già presente ${person.listType}: ${person.lastName} ${person.firstName}`);
        }
      } catch (error: any) {
        const errorMsg = `Errore importando "${person.originalValue}": ${error.message}`;
        result.errors.push(errorMsg);
        logger.error(errorMsg);
      }
    }

    // 3. Opzionale: elimina dal DB gli invitati non più presenti nei fogli (prune)
    if (options?.pruneMissing) {
      const all = await prisma.invitee.findMany({
        where: { eventId },
        select: { id: true, firstName: true, lastName: true },
      });
      const toDelete = all.filter(inv => !sheetKeys.has(makeKey(inv.firstName, inv.lastName)));
      if (toDelete.length > 0) {
        // elimina in batch
        await prisma.invitee.deleteMany({ where: { id: { in: toDelete.map(t => t.id) } } });
        logger.warn(`🗑️  Pruned ${toDelete.length} invitees non presenti nei Google Sheets`);
      }
      // Nota: i log di check-in associati rimangono; potremmo ripulirli se necessario.
    }

    result.success = result.errors.length === 0 || result.newImported > 0;
    result.duration = Date.now() - startTime;

    logger.info(
      `✅ Sincronizzazione completata: ${result.newImported} nuovi ` +
      `(${result.breakdown.paganti.imported} PAGANTI, ${result.breakdown.green.imported} GREEN), ` +
      `${result.alreadyExists} già presenti, ${result.errors.length} errori ` +
      `(${result.duration}ms)`
    );

    return result;
  } catch (error: any) {
    logger.error("❌ Errore sincronizzazione Google Sheets:", error);
    result.errors.push(error.message);
    result.duration = Date.now() - startTime;
    return result;
  }
}

/**
 * Importa una persona se non esiste già nel database per questo evento
 * Controllo duplicati: firstName + lastName (case-insensitive) all'interno dell'evento
 *
 * @returns true se importato, false se già esistente
 */
export async function importPersonIfNotExists(person: ParsedPerson, eventId: string): Promise<boolean> {
  const { firstName, lastName, listType, paymentType } = person;

  // Cerca se esiste già (controllo case-insensitive manuale)
  // SQLite non supporta mode: 'insensitive', quindi recuperiamo tutti e filtriamo in memoria
  const allInvitees = await prisma.invitee.findMany({
    where: { eventId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      listType: true,
      paymentType: true,
    },
  });

  const norm = (s: string) => s
    .normalize("NFC")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  const existing = allInvitees.find(
    (inv) => norm(inv.firstName) === norm(firstName) && norm(inv.lastName) === norm(lastName)
  );

  if (existing) {
    // Se esiste e la sorgente attuale è PAGANTE ma in DB è GREEN, promuovi a PAGANTE
    if (listType === "PAGANTE" && existing.listType === "GREEN") {
      await prisma.invitee.update({
        where: { id: existing.id },
        data: {
          listType: "PAGANTE",
          paymentType: paymentType ?? existing.paymentType ?? null,
        },
      });
    }
    return false; // Già presente (eventualmente aggiornato)
  }

  // Non esiste -> crea nuovo invitato (senza scrivere su Google Sheets)
  await prisma.invitee.create({
    data: {
      firstName: (firstName || "").trim().replace(/\s+/g, " "),
      lastName: lastName.trim().replace(/\s+/g, " "),
      listType: listType as ListType,
      paymentType: listType === "PAGANTE" ? (paymentType ?? null) : null,
      hasEntered: false,
      eventId,
    },
  });

  return true; // Importato
}

/**
 * Timer per sincronizzazione automatica periodica
 */
let syncIntervalId: NodeJS.Timeout | null = null;

/**
 * Avvia la sincronizzazione automatica periodica per tutti gli eventi attivi
 * @param intervalMinutes Intervallo in minuti (default: 10)
 */
export function startAutoSync(intervalMinutes: number = 10): void {
  if (syncIntervalId) {
    logger.warn("Auto-sync già attivo, non avvio duplicato");
    return;
  }

  const intervalMs = intervalMinutes * 60 * 1000;

  logger.info(`🚀 Avvio auto-sync Google Sheets ogni ${intervalMinutes} minuti`);

  // Helper per sincronizzare tutti gli eventi attivi
  const syncAllActiveEvents = async () => {
    const activeEvents = await prisma.event.findMany({
      where: { status: "ACTIVE" },
      select: { id: true },
    });

    for (const event of activeEvents) {
      try {
        await syncGoogleSheetToDatabase(event.id);
      } catch (error) {
        logger.error(`Errore sincronizzazione persone evento ${event.id}:`, { error });
      }
      try {
        await syncTshirtsFromGoogleSheets(event.id);
      } catch (error) {
        logger.error(`Errore sincronizzazione magliette evento ${event.id}:`, { error });
      }
    }
  };

  // Prima sincronizzazione immediata
  syncAllActiveEvents().catch(error => {
    logger.error("Errore prima sincronizzazione:", { error });
  });

  // Poi ogni X minuti
  syncIntervalId = setInterval(() => {
    syncAllActiveEvents().catch(error => {
      logger.error("Errore sincronizzazione automatica:", { error });
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
    logger.info("🛑 Auto-sync Google Sheets fermato");
  }
}

/**
 * Verifica se l'auto-sync è attivo
 */
export function isAutoSyncActive(): boolean {
  return syncIntervalId !== null;
}
