import { prisma } from "../lib/prisma";
import { config } from "../config";
import { AppError } from "../utils/errors";
import { ShuttleBoardStatus, ShuttleDirection } from "@prisma/client";
import { readShuttlesSheet, updateShuttleCellInGoogleSheet, readShuttleTimesFromSheet, ParsedShuttleAssignment } from "./googleSheetsService";
import { logger } from "../logger";

const parseTime = (hhmm: string) => {
  const [h, m] = hhmm.split(":");
  return { h: Number(h), m: Number(m) };
};

const formatTime = (h: number, m: number) => `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

const timeToMinutes = (t: string) => {
  const { h, m } = parseTime(t);
  return h * 60 + m;
};

export const generateTimes = (from: string, to: string, step: number): string[] => {
  // Supports ranges crossing midnight by interpreting `to` as next day if to < from
  const start = timeToMinutes(from);
  let end = timeToMinutes(to);
  const crossMidnight = end < start;
  if (crossMidnight) end += 24 * 60;

  const out: string[] = [];
  for (let t = start; t <= end; t += step) {
    const minutes = t % (24 * 60);
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    out.push(formatTime(h, m));
  }
  return out;
};

export const ensureShuttleSetup = async (eventId: string) => {
  const step = config.shuttle.stepMinutes;
  const timesOut = generateTimes(config.shuttle.outbound.from, config.shuttle.outbound.to, step);
  const timesRet = generateTimes(config.shuttle.return.from, config.shuttle.return.to, step);

  for (const t of timesOut) {
    await prisma.shuttleSlot.upsert({
      where: { direction_time_eventId: { direction: "ANDATA", time: t, eventId } },
      update: {},
      create: { direction: "ANDATA", time: t, capacity: config.shuttle.slotCapacity, eventId },
    });
  }
  for (const t of timesRet) {
    await prisma.shuttleSlot.upsert({
      where: { direction_time_eventId: { direction: "RITORNO", time: t, eventId } },
      update: {},
      create: { direction: "RITORNO", time: t, capacity: config.shuttle.slotCapacity, eventId },
    });
  }

  for (const name of config.shuttle.defaultMachines) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    await prisma.shuttleMachine.upsert({
      where: { name_eventId: { name: trimmed, eventId } },
      update: { active: true },
      create: { name: trimmed, eventId },
    });
  }
};

export const listMachines = async (eventId: string) =>
  prisma.shuttleMachine.findMany({ where: { eventId }, orderBy: { name: "asc" } });

export const createMachine = async (name: string, color: string | undefined, eventId: string) => {
  if (!name?.trim()) throw new AppError("Nome macchina obbligatorio", 400);
  return prisma.shuttleMachine.create({ data: { name: name.trim(), color, eventId } });
};

export const updateMachine = async (id: string, data: { name?: string; color?: string; active?: boolean }) => {
  return prisma.shuttleMachine.update({ where: { id }, data });
};

export const deleteMachine = async (id: string) => {
  const count = await prisma.shuttleAssignment.count({ where: { machineId: id } });
  if (count > 0) throw new AppError("Impossibile eliminare: macchina con assegnazioni", 400);
  await prisma.shuttleMachine.delete({ where: { id } });
};

export const deleteSlot = async (direction: ShuttleDirection, time: string, eventId: string, syncWithSheets = true) => {
  // Trova lo slot
  const slot = await prisma.shuttleSlot.findUnique({
    where: { direction_time_eventId: { direction, time, eventId } },
  });

  if (!slot) {
    throw new AppError("Slot non trovato", 404);
  }

  // Elimina tutte le assegnazioni per questo slot
  await prisma.shuttleAssignment.deleteMany({
    where: { slotId: slot.id },
  });

  // Elimina lo slot
  await prisma.shuttleSlot.delete({
    where: { id: slot.id },
  });

  // Sincronizza con Google Sheets (elimina colonna) — solo se l'evento ha un foglio
  if (syncWithSheets) {
    try {
      const evSheet = await prisma.event.findUnique({ where: { id: eventId }, select: { googleSheetId: true } });
      if (evSheet?.googleSheetId) {
        const { deleteShuttleSlotFromSheet } = await import("./googleSheetsService");
        await deleteShuttleSlotFromSheet(evSheet.googleSheetId, direction, time);
        logger.info(`Slot ${direction} ${time} eliminato anche da Google Sheets`);
      }
    } catch (error: any) {
      logger.error(`Errore eliminazione slot da Google Sheets: ${error.message}`);
    }
  }

  logger.info(`Slot ${direction} ${time} eliminato con successo`);
};

export const listSlots = async (direction: ShuttleDirection, eventId: string) => {
  const slots = await prisma.shuttleSlot.findMany({ where: { direction, eventId } });

  // Ordina cronologicamente gestendo il passaggio mezzanotte
  // Orari dopo mezzanotte (00:00 - 06:00) vengono trattati come giorno dopo
  const sortedSlots = slots.sort((a, b) => {
    const minutesA = timeToMinutes(a.time);
    const minutesB = timeToMinutes(b.time);

    // Se l'orario è prima delle 06:00 (360 minuti), aggiungi 24 ore (1440 minuti)
    // così 00:10 diventa 24:10 e viene dopo 22:30
    const adjustedA = minutesA < 360 ? minutesA + 1440 : minutesA;
    const adjustedB = minutesB < 360 ? minutesB + 1440 : minutesB;

    return adjustedA - adjustedB;
  });

  // add occupancy count
  const counts = await prisma.shuttleAssignment.groupBy({
    by: ["slotId"],
    _count: { slotId: true },
    where: { slot: { direction, eventId } },
  });
  const countMap = new Map(counts.map((c) => [c.slotId, c._count.slotId]));
  return sortedSlots.map((s) => ({ ...s, occupancy: countMap.get(s.id) ?? 0 }));
};

export const listAssignments = async (
  params: { direction?: ShuttleDirection; time?: string; machineId?: string },
  eventId: string
) => {
  const { direction, time, machineId } = params;
  return prisma.shuttleAssignment.findMany({
    where: {
      machineId: machineId,
      slot: {
        direction: direction,
        time: time,
        eventId,
      },
    },
    include: { invitee: true, slot: true, machine: true },
    orderBy: [{ slot: { time: "asc" } }, { machine: { name: "asc" } }, { createdAt: "asc" }],
  });
};

export const createAssignment = async (
  data: {
    direction: ShuttleDirection;
    time: string;
    machineId: string;
    inviteeId?: string;
    fullName?: string;
  },
  eventId: string
) => {
  const { direction, time, machineId, inviteeId, fullName } = data;
  if (!inviteeId && !fullName) throw new AppError("Specificare inviteeId o fullName", 400);

  const slot = await prisma.shuttleSlot.findUnique({
    where: { direction_time_eventId: { direction, time, eventId } },
  });
  if (!slot) throw new AppError("Fascia oraria non trovata", 404);

  const machine = await prisma.shuttleMachine.findUnique({ where: { id: machineId } });
  if (!machine) throw new AppError("Macchina non trovata", 404);
  if (!machine.active) throw new AppError("Macchina disattivata", 400);

  // Validate slot capacity
  const slotCount = await prisma.shuttleAssignment.count({ where: { slotId: slot.id } });
  if (slotCount >= slot.capacity) throw new AppError("Fascia oraria piena", 409);

  // Validate machine capacity for that slot
  const machineCount = await prisma.shuttleAssignment.count({ where: { slotId: slot.id, machineId } });
  if (machineCount >= config.shuttle.machineCapacity) throw new AppError("Macchina piena per questa fascia", 409);

  // Optional: prevent double booking per direction for same invitee
  if (inviteeId) {
    const existsSameDirection = await prisma.shuttleAssignment.findFirst({
      where: { inviteeId, slot: { direction, eventId } },
      select: { id: true },
    });
    if (existsSameDirection) throw new AppError("Persona già assegnata per questa direzione", 409);
  }

  const created = await prisma.shuttleAssignment.create({
    data: {
      slotId: slot.id,
      machineId,
      inviteeId: inviteeId ?? null,
      fullName: fullName ?? "",
    },
    include: { invitee: true, slot: true, machine: true },
  });

  // Export automatico verso Google Sheets (in background, non blocca l'operazione)
  exportAssignmentToGoogleSheets(created.id, "create").catch((err) =>
    logger.error(`Errore export assegnazione ${created.id} verso Sheets:`, err)
  );

  return created;
};

export const updateAssignmentStatus = async (
  id: string,
  status: ShuttleBoardStatus,
  userId?: string,
) => {
  if (!Object.values(ShuttleBoardStatus).includes(status)) throw new AppError("Stato non valido", 400);
  return prisma.shuttleAssignment.update({
    where: { id },
    data: {
      status,
      markedById: userId ?? null,
      markedAt: new Date(),
    },
    include: { invitee: true, slot: true, machine: true },
  });
};

export const deleteAssignment = async (id: string) => {
  // Export verso Sheets PRIMA di eliminare (così abbiamo ancora i dati)
  // Facciamo await ma catchiamo gli errori per non bloccare l'operazione
  try {
    await exportAssignmentToGoogleSheets(id, "delete");
  } catch (err: any) {
    logger.error(`Errore export delete assegnazione ${id} verso Sheets:`, err?.message || err);
    // Continuiamo comunque con il delete dall'app
  }

  await prisma.shuttleAssignment.delete({ where: { id } });
};

/**
 * SINCRONIZZAZIONE GOOGLE SHEETS
 */

/**
 * Helper per parsare nome completo in firstName/lastName
 * Gestisce formati misti: "Nome Cognome" oppure "Cognome Nome"
 */
function parseFullName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);

  if (parts.length === 1) {
    return { firstName: "", lastName: parts[0] };
  }

  // Assumiamo che l'ultima parola sia il nome, il resto cognome
  // (come nel parser esistente per invitati)
  const firstName = parts.pop()!;
  const lastName = parts.join(" ");

  return { firstName, lastName };
}

/**
 * Importa le assegnazioni navette da Google Sheets
 * Crea slot, macchine e assegnazioni se non esistono
 * @param direction "ANDATA" o "RITORNO"
 * @param eventId ID dell'evento
 * @param pruneMissing Se true, rimuove assegnazioni non più presenti su Sheets
 * @returns Statistiche import
 */
export async function syncShuttlesFromGoogleSheets(
  direction: ShuttleDirection,
  eventId: string,
  pruneMissing = false
): Promise<{
  newImported: number;
  updated: number;
  alreadyExists: number;
  deleted: number;
}> {
  logger.info(`Inizio sincronizzazione navette ${direction} da Google Sheets`);

  // Recupera il googleSheetId dell'evento — se non configurato, salta
  const ev = await prisma.event.findUnique({ where: { id: eventId }, select: { googleSheetId: true } });
  if (!ev?.googleSheetId) {
    logger.info(`Evento ${eventId} senza Google Sheet — sync navette saltato`);
    return { newImported: 0, updated: 0, alreadyExists: 0, deleted: 0 };
  }

  // Leggi dati da Google Sheets dell'evento
  const sheetAssignments = await readShuttlesSheet(ev.googleSheetId, direction);

  logger.info(`Lette ${sheetAssignments.length} assegnazioni da Google Sheets`);

  let newImported = 0;
  let updated = 0;
  let alreadyExists = 0;

  // Mappa per tracciare le assegnazioni viste
  const seenAssignments = new Set<string>();

  for (const sheetAssignment of sheetAssignments) {
    try {
      // 1. Assicurati che lo slot esista
      const slot = await prisma.shuttleSlot.upsert({
        where: {
          direction_time_eventId: {
            direction,
            time: sheetAssignment.slotTime,
            eventId,
          },
        },
        update: {},
        create: {
          direction,
          time: sheetAssignment.slotTime,
          capacity: config.shuttle.slotCapacity,
          eventId,
        },
      });

      // 2. Assicurati che la macchina esista
      const machine = await prisma.shuttleMachine.upsert({
        where: { name_eventId: { name: sheetAssignment.machineName, eventId } },
        update: { active: true },
        create: { name: sheetAssignment.machineName, active: true, eventId },
      });

      // 3. Controlla se l'assegnazione esiste già
      // Cerchiamo per: slotId + machineId + fullName
      const existing = await prisma.shuttleAssignment.findFirst({
        where: {
          slotId: slot.id,
          machineId: machine.id,
          fullName: sheetAssignment.fullName,
        },
      });

      if (existing) {
        alreadyExists++;
        seenAssignments.add(existing.id);
      } else {
        // Crea nuova assegnazione
        const created = await prisma.shuttleAssignment.create({
          data: {
            slotId: slot.id,
            machineId: machine.id,
            fullName: sheetAssignment.fullName,
            inviteeId: null, // Potremmo cercare l'invitee per nome, ma per ora null
          },
        });
        newImported++;
        seenAssignments.add(created.id);
        logger.info(`Creata assegnazione: ${sheetAssignment.fullName} su ${machine.name} alle ${slot.time}`);
      }
    } catch (error: any) {
      logger.error(`Errore importando assegnazione ${sheetAssignment.fullName}:`, error.message);
    }
  }

  // Se richiesto, elimina assegnazioni non più presenti su Sheets
  let deleted = 0;
  if (pruneMissing) {
    const allDbAssignments = await prisma.shuttleAssignment.findMany({
      where: {
        slot: { direction, eventId },
      },
      select: { id: true },
    });

    for (const dbAssignment of allDbAssignments) {
      if (!seenAssignments.has(dbAssignment.id)) {
        await prisma.shuttleAssignment.delete({ where: { id: dbAssignment.id } });
        deleted++;
      }
    }
  }

  logger.info(`Sincronizzazione navette ${direction} completata: ${newImported} nuove, ${alreadyExists} esistenti, ${deleted} eliminate`);

  return {
    newImported,
    updated,
    alreadyExists,
    deleted,
  };
}

/**
 * Trova la posizione di una cella nel foglio navette basandosi su machine e time
 * @param direction ANDATA o RITORNO
 * @param machineName Nome macchina (es. "MACCHINA 1")
 * @param slotTime Orario slot (es. "22:30")
 * @param fullName Nome persona da cercare (per trovare la riga specifica)
 * @returns Posizione cella { row, col } o null se non trovata
 */
async function findShuttleCellPosition(
  spreadsheetId: string,
  direction: "ANDATA" | "RITORNO",
  machineName: string,
  slotTime: string,
  fullName?: string
): Promise<{ row: number; col: string } | null> {
  // Leggi tutte le assegnazioni dal foglio per trovare gli orari e le posizioni
  const sheetAssignments = await readShuttlesSheet(spreadsheetId, direction);

  // Trova tutte le celle per questa macchina e time
  const matchingCells = sheetAssignments.filter(
    (a) => a.machineName === machineName && a.slotTime === slotTime
  );

  if (fullName) {
    // Cerca la cella con questo nome specifico
    const exactMatch = matchingCells.find((a) => a.fullName === fullName);
    if (exactMatch) {
      return exactMatch.cellPosition;
    }
  }

  // Se non troviamo un match esatto, cerchiamo la prima cella vuota
  // Dobbiamo controllare quali righe sono occupate per questa macchina e time

  // Mappa macchine → range righe
  const machineRowRanges: Record<string, { startRow: number; endRow: number }> = {
    "MACCHINA 1": { startRow: 2, endRow: 5 },
    "MACCHINA 2": { startRow: 6, endRow: 9 },
    "MACCHINA 3": { startRow: 10, endRow: 13 },
  };

  const rowRange = machineRowRanges[machineName];
  if (!rowRange) {
    logger.warn(`Macchina ${machineName} non trovata nel mapping righe`);
    return null;
  }

  // Trova la colonna per il time leggendo gli orari dalla riga 1
  const times = await readShuttleTimesFromSheet(spreadsheetId, direction);
  const timeIdx = times.findIndex((t) => t === slotTime);

  if (timeIdx === -1) {
    logger.warn(`Time ${slotTime} non trovato nella riga 1 del foglio navette ${direction}`);
    return null;
  }

  const colLetter = String.fromCharCode(66 + timeIdx); // B=66, C=67, etc.

  // Trova la prima riga disponibile nel range
  const occupiedRows = matchingCells.map((c) => c.cellPosition.row);

  for (let row = rowRange.startRow; row <= rowRange.endRow; row++) {
    if (!occupiedRows.includes(row)) {
      return { row, col: colLetter };
    }
  }

  // Tutte le righe sono occupate
  logger.warn(`Tutte le righe per ${machineName} slot ${slotTime} sono occupate`);
  return null;
}

/**
 * Esporta un'assegnazione verso Google Sheets
 * @param assignmentId ID assegnazione da esportare
 * @param action "create" o "delete"
 */
export async function exportAssignmentToGoogleSheets(
  assignmentId: string,
  action: "create" | "delete"
): Promise<void> {
  const assignment = await prisma.shuttleAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      slot: true,
      machine: true,
    },
  });

  if (!assignment) {
    throw new AppError("Assegnazione non trovata", 404);
  }

  const direction = assignment.slot.direction === "ANDATA" ? "ANDATA" : "RITORNO";

  // Recupera il googleSheetId dell'evento — se non configurato, skip
  const ev = await prisma.event.findUnique({ where: { id: assignment.slot.eventId }, select: { googleSheetId: true } });
  if (!ev?.googleSheetId) {
    logger.info(`Evento senza Google Sheet — export navette saltato`);
    return;
  }
  const spreadsheetId = ev.googleSheetId;

  try {
    if (action === "create") {
      // Trova una cella disponibile per questa macchina e time
      const cellPos = await findShuttleCellPosition(
        spreadsheetId,
        direction,
        assignment.machine.name,
        assignment.slot.time
      );

      if (!cellPos) {
        logger.error(
          `Impossibile trovare cella disponibile per ${assignment.machine.name} ${assignment.slot.time}`
        );
        return;
      }

      // Scrivi il nome nella cella
      await updateShuttleCellInGoogleSheet(spreadsheetId, direction, cellPos, assignment.fullName);

      logger.info(
        `Esportata assegnazione ${assignment.fullName} su Sheets: ${cellPos.col}${cellPos.row}`
      );
    } else if (action === "delete") {
      // Trova la cella con questo nome specifico
      const cellPos = await findShuttleCellPosition(
        spreadsheetId,
        direction,
        assignment.machine.name,
        assignment.slot.time,
        assignment.fullName
      );

      if (!cellPos) {
        logger.warn(
          `Cella per ${assignment.fullName} non trovata su Sheets, skip delete`
        );
        return;
      }

      // Svuota la cella
      await updateShuttleCellInGoogleSheet(spreadsheetId, direction, cellPos, "");

      logger.info(
        `Eliminata assegnazione ${assignment.fullName} da Sheets: ${cellPos.col}${cellPos.row}`
      );
    }
  } catch (error: any) {
    logger.error("Errore export assegnazione verso Sheets:", error.message);
    // Non facciamo throw per evitare di bloccare l'operazione principale
  }
}
