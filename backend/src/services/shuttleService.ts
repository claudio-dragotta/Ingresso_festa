import { prisma } from "../lib/prisma";
import { config } from "../config";
import { AppError } from "../utils/errors";
import { ShuttleBoardStatus, ShuttleDirection } from "@prisma/client";
import { readShuttlesSheet, updateShuttleCellInGoogleSheet, ParsedShuttleAssignment } from "./googleSheetsService";
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

export const ensureShuttleSetup = async () => {
  const step = config.shuttle.stepMinutes;
  const timesOut = generateTimes(config.shuttle.outbound.from, config.shuttle.outbound.to, step);
  const timesRet = generateTimes(config.shuttle.return.from, config.shuttle.return.to, step);

  for (const t of timesOut) {
    await prisma.shuttleSlot.upsert({
      where: { direction_time: { direction: "ANDATA", time: t } },
      update: {},
      create: { direction: "ANDATA", time: t, capacity: config.shuttle.slotCapacity },
    });
  }
  for (const t of timesRet) {
    await prisma.shuttleSlot.upsert({
      where: { direction_time: { direction: "RITORNO", time: t } },
      update: {},
      create: { direction: "RITORNO", time: t, capacity: config.shuttle.slotCapacity },
    });
  }

  for (const name of config.shuttle.defaultMachines) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    await prisma.shuttleMachine.upsert({
      where: { name: trimmed },
      update: { active: true },
      create: { name: trimmed },
    });
  }
};

export const listMachines = async () => prisma.shuttleMachine.findMany({ orderBy: { name: "asc" } });

export const createMachine = async (name: string, color?: string) => {
  if (!name?.trim()) throw new AppError("Nome macchina obbligatorio", 400);
  return prisma.shuttleMachine.create({ data: { name: name.trim(), color } });
};

export const updateMachine = async (id: string, data: { name?: string; color?: string; active?: boolean }) => {
  return prisma.shuttleMachine.update({ where: { id }, data });
};

export const deleteMachine = async (id: string) => {
  const count = await prisma.shuttleAssignment.count({ where: { machineId: id } });
  if (count > 0) throw new AppError("Impossibile eliminare: macchina con assegnazioni", 400);
  await prisma.shuttleMachine.delete({ where: { id } });
};

export const listSlots = async (direction: ShuttleDirection) => {
  const slots = await prisma.shuttleSlot.findMany({ where: { direction }, orderBy: { time: "asc" } });
  // add occupancy count
  const counts = await prisma.shuttleAssignment.groupBy({
    by: ["slotId"],
    _count: { slotId: true },
    where: { slot: { direction } },
  });
  const countMap = new Map(counts.map((c) => [c.slotId, c._count.slotId]));
  return slots.map((s) => ({ ...s, occupancy: countMap.get(s.id) ?? 0 }));
};

export const listAssignments = async (params: { direction?: ShuttleDirection; time?: string; machineId?: string }) => {
  const { direction, time, machineId } = params;
  return prisma.shuttleAssignment.findMany({
    where: {
      machineId: machineId,
      slot: {
        direction: direction,
        time: time,
      },
    },
    include: { invitee: true, slot: true, machine: true },
    orderBy: [{ slot: { time: "asc" } }, { machine: { name: "asc" } }, { createdAt: "asc" }],
  });
};

export const createAssignment = async (data: {
  direction: ShuttleDirection;
  time: string;
  machineId: string;
  inviteeId?: string;
  fullName?: string;
}) => {
  const { direction, time, machineId, inviteeId, fullName } = data;
  if (!inviteeId && !fullName) throw new AppError("Specificare inviteeId o fullName", 400);

  const slot = await prisma.shuttleSlot.findUnique({ where: { direction_time: { direction, time } } });
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
      where: { inviteeId, slot: { direction } },
      select: { id: true },
    });
    if (existsSameDirection) throw new AppError("Persona già assegnata per questa direzione", 409);
  }

  return prisma.shuttleAssignment.create({
    data: {
      slotId: slot.id,
      machineId,
      inviteeId: inviteeId ?? null,
      fullName: fullName ?? "",
    },
    include: { invitee: true, slot: true, machine: true },
  });
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
    return { firstName: '', lastName: parts[0] };
  }

  // Assumiamo che l'ultima parola sia il nome, il resto cognome
  // (come nel parser esistente per invitati)
  const firstName = parts.pop()!;
  const lastName = parts.join(' ');

  return { firstName, lastName };
}

/**
 * Importa le assegnazioni navette da Google Sheets
 * Crea slot, macchine e assegnazioni se non esistono
 * @param direction "ANDATA" o "RITORNO"
 * @param pruneMissing Se true, rimuove assegnazioni non più presenti su Sheets
 * @returns Statistiche import
 */
export async function syncShuttlesFromGoogleSheets(
  direction: ShuttleDirection,
  pruneMissing = false
): Promise<{
  newImported: number;
  updated: number;
  alreadyExists: number;
  deleted: number;
}> {
  logger.info(`Inizio sincronizzazione navette ${direction} da Google Sheets`);

  // Leggi dati da Google Sheets
  const sheetAssignments = await readShuttlesSheet(direction);

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
          direction_time: {
            direction,
            time: sheetAssignment.slotTime,
          },
        },
        update: {},
        create: {
          direction,
          time: sheetAssignment.slotTime,
          capacity: config.shuttle.slotCapacity,
        },
      });

      // 2. Assicurati che la macchina esista
      const machine = await prisma.shuttleMachine.upsert({
        where: { name: sheetAssignment.machineName },
        update: { active: true },
        create: { name: sheetAssignment.machineName, active: true },
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
        slot: { direction },
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
 * Esporta un'assegnazione modificata verso Google Sheets
 * @param assignment L'assegnazione da esportare
 */
export async function exportAssignmentToGoogleSheets(assignmentId: string): Promise<void> {
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

  // Ricostruiamo la posizione della cella basandoci su:
  // - Slot time → colonna
  // - Machine name → range di righe

  const direction = assignment.slot.direction === 'ANDATA' ? 'ANDATA' : 'RITORNO';

  // Calcola colonna dal time
  // Assumiamo che i tempi siano sequenziali e inizino da colonna B
  // Per ora, dobbiamo leggere il foglio per capire quale colonna corrisponde al time
  // Questa è una limitazione - in produzione, meglio mantenere un mapping in config

  // TODO: Per ora skippiamo l'export automatico
  // In alternativa, possiamo implementare un endpoint manuale "Export to Sheets"

  logger.warn(`Export automatico verso Sheets non ancora implementato per assegnazione ${assignmentId}`);
}

