import { Prisma, ListType } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../utils/errors";
import { logger } from "../logger";
import { writeToGoogleSheet } from "./googleSheetsService";

export interface InviteeInput {
  firstName: string;
  lastName: string;
  listType: ListType; // PAGANTE o GREEN
  paymentType?: string; // Solo per PAGANTE: bonifico, paypal, contanti, p2p
}

const normalize = (value: string) => value.trim().replace(/\s+/g, " ");
// Normalizzazione SOLO per confronto (case-insensitive, spazi compattati),
// senza rimuovere accenti: gli accenti restano parte del nome/cognome.
const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
const normalizedKey = (firstName: string, lastName: string) => `${normalizeText(firstName)}|${normalizeText(lastName)}`;

const buildFullName = (firstName: string, lastName: string) =>
  `${normalize(firstName)} ${normalize(lastName)}`.trim();

export const createInvitee = async (input: InviteeInput) => {
  // Controllo duplicati PRIMA di creare
  const allInvitees = await prisma.invitee.findMany({
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
  });

  const targetKey = normalizedKey(input.firstName, input.lastName);
  const existing = allInvitees.find((inv) => normalizedKey(inv.firstName, inv.lastName) === targetKey);

  if (existing) {
    throw new AppError(
      `Invitato già presente: ${normalize(input.lastName)} ${normalize(input.firstName)}`,
      409 // Conflict
    );
  }

  const invitee = await prisma.invitee.create({
    data: {
      firstName: normalize(input.firstName),
      lastName: normalize(input.lastName),
      listType: input.listType,
      paymentType: input.listType === 'PAGANTE' ? input.paymentType?.trim().toLowerCase() : null,
      hasEntered: false,
    },
  });

  // Sincronizza con Google Sheets (scrittura bidirezionale)
  try {
    const fullName = `${normalize(input.lastName)} ${normalize(input.firstName)}`;
    await writeToGoogleSheet(
      fullName,
      input.listType,
      input.listType === 'PAGANTE' ? input.paymentType : undefined
    );
    logger.info(`✅ Scritto su Google Sheets: ${fullName} (${input.listType})`);
  } catch (error: any) {
    // Non blocchiamo l'operazione se la scrittura su Google Sheets fallisce
    // L'invitato è già stato creato nel DB
    logger.error(`⚠️  Errore scrittura Google Sheets per ${normalize(input.lastName)} ${normalize(input.firstName)}:`, error.message);
    logger.warn('L\'invitato è stato creato nel DB ma non sincronizzato su Google Sheets');
  }

  return invitee;
};

export const createInviteesBulk = async (inputs: InviteeInput[]) => {
  const results = [];
  for (const input of inputs) {
    const allInvitees = await prisma.invitee.findMany({ select: { id: true, firstName: true, lastName: true } });
    const targetKey = normalizedKey(input.firstName, input.lastName);
    const existing = allInvitees.find((inv) => normalizedKey(inv.firstName, inv.lastName) === targetKey);

    if (existing) {
      logger.warn("Invitee already exists, skipping", { inviteeId: existing.id });
      continue;
    }

    const created = await createInvitee(input);
    results.push(created);
  }

  return results;
};

export const listInvitees = async () => {
  const invitees = await prisma.invitee.findMany({
    orderBy: [
      { lastName: "asc" },
      { firstName: "asc" },
    ],
  });
  return invitees;
};

export const searchInvitees = async (query: string) => {
  const invitees = await prisma.invitee.findMany({
    orderBy: [
      { lastName: "asc" },
      { firstName: "asc" },
    ],
  });

  // Filtra i risultati in memoria per ricerca case-insensitive
  const searchTerm = query.toLowerCase();
  return invitees.filter(inv =>
    inv.firstName.toLowerCase().includes(searchTerm) ||
    inv.lastName.toLowerCase().includes(searchTerm) ||
    `${inv.firstName} ${inv.lastName}`.toLowerCase().includes(searchTerm) ||
    `${inv.lastName} ${inv.firstName}`.toLowerCase().includes(searchTerm)
  );
};

export const markCheckIn = async (inviteeId: string, adminOverride: boolean = false) => {
  const systemConfig = await prisma.systemConfig.findFirst();
  if (!systemConfig || systemConfig.eventStatus === "LOCKED") {
    await prisma.checkInLog.create({
      data: {
        outcome: "BLOCKED",
        message: "Sistema bloccato",
        inviteeId,
      },
    });
    throw new AppError("Sistema bloccato", 423, { status: systemConfig?.eventStatus ?? "LOCKED" });
  }

  if (systemConfig.eventStatus === "PAUSED") {
    throw new AppError("Registrazioni momentaneamente sospese", 423, { status: systemConfig.eventStatus });
  }

  const invitee = await prisma.invitee.findUnique({ where: { id: inviteeId } });
  if (!invitee) {
    await prisma.checkInLog.create({
      data: {
        outcome: "BLOCKED",
        message: "Invitato non trovato",
      },
    });
    throw new AppError("Invitato non trovato", 404);
  }

  // Solo admin può rimettere come "non entrato"
  if (invitee.hasEntered && !adminOverride) {
    await prisma.checkInLog.create({
      data: {
        invitee: { connect: { id: invitee.id } },
        outcome: "DUPLICATE",
        message: "Già entrato",
      },
    });
    throw new AppError("Persona già entrata", 409, {
      checkedInAt: invitee.checkedInAt,
      invitee,
    });
  }

  // Toggle dello stato
  const newState = !invitee.hasEntered;
  const updated = await prisma.invitee.update({
    where: { id: invitee.id },
    data: {
      hasEntered: newState,
      checkedInAt: newState ? new Date() : null,
    },
  });

  await prisma.checkInLog.create({
    data: {
      invitee: { connect: { id: invitee.id } },
      outcome: "SUCCESS",
      message: newState ? "Ingresso autorizzato" : "Reimpostato come non entrato",
    },
  });

  return updated;
};

export const resetCheckIn = async (inviteeId: string) => {
  const invitee = await prisma.invitee.update({
    where: { id: inviteeId },
    data: {
      hasEntered: false,
      checkedInAt: null,
    },
  });
  return invitee;
};

export const deleteInvitee = async (inviteeId: string) => {
  await prisma.invitee.delete({ where: { id: inviteeId } });
};

// Statistiche per i contatori
export const getStats = async () => {
  const [pagantiTotal, pagantiEntered, greenTotal, greenEntered] = await Promise.all([
    prisma.invitee.count({ where: { listType: 'PAGANTE' } }),
    prisma.invitee.count({ where: { listType: 'PAGANTE', hasEntered: true } }),
    prisma.invitee.count({ where: { listType: 'GREEN' } }),
    prisma.invitee.count({ where: { listType: 'GREEN', hasEntered: true } }),
  ]);

  return {
    paganti: {
      total: pagantiTotal,
      entered: pagantiEntered,
      remaining: pagantiTotal - pagantiEntered,
    },
    green: {
      total: greenTotal,
      entered: greenEntered,
      remaining: greenTotal - greenEntered,
    },
    total: {
      total: pagantiTotal + greenTotal,
      entered: pagantiEntered + greenEntered,
      remaining: (pagantiTotal + greenTotal) - (pagantiEntered + greenEntered),
    },
  };
};

export const getDuplicateInviteeGroups = async () => {
  const invitees = await prisma.invitee.findMany({
    orderBy: [
      { lastName: "asc" },
      { firstName: "asc" },
    ],
  });

  const groups = new Map<string, typeof invitees>();
  for (const inv of invitees) {
    const key = normalizedKey(inv.firstName, inv.lastName);
    const list = groups.get(key) ?? [];
    list.push(inv);
    groups.set(key, list);
  }

  const duplicates = Array.from(groups.entries())
    .filter(([, items]) => items.length > 1)
    .map(([key, items]) => ({ key, count: items.length, items }));

  return duplicates;
};

export const promoteDuplicateGroupToPagante = async (key: string, paymentType?: string) => {
  const invitees = await prisma.invitee.findMany();
  const target = invitees.filter((inv) => normalizedKey(inv.firstName, inv.lastName) === key);
  if (target.length === 0) return { updated: 0 };
  let updated = 0;
  for (const inv of target) {
    if (inv.listType !== 'PAGANTE' || (paymentType && inv.paymentType !== paymentType)) {
      await prisma.invitee.update({
        where: { id: inv.id },
        data: {
          listType: 'PAGANTE',
          paymentType: paymentType ? paymentType.trim().toLowerCase() : inv.paymentType,
        },
      });
      updated++;
    }
  }
  return { updated };
};

export const keepOneAndDeleteOthersInGroup = async (key: string, keepId: string) => {
  const invitees = await prisma.invitee.findMany();
  const group = invitees.filter((inv) => normalizedKey(inv.firstName, inv.lastName) === key);
  if (group.length <= 1) return { deleted: 0 };
  const toDelete = group.filter((inv) => inv.id !== keepId);
  for (const inv of toDelete) {
    await prisma.invitee.delete({ where: { id: inv.id } });
  }
  return { deleted: toDelete.length };
};
