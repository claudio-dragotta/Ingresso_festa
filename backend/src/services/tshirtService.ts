import { prisma } from "../lib/prisma";
import { AppError } from "../utils/errors";
import { readTshirtsSheet, writeTshirtToGoogleSheet, updateTshirtInGoogleSheet } from "./googleSheetsService";
import { logger } from "../logger";

export interface TshirtInput {
  firstName: string;
  lastName: string;
  size: string;
  type: string;
}

export interface TshirtStats {
  total: number;
  received: number;
  pending: number;
  bySizeAndType: Record<string, { total: number; received: number; pending: number }>;
}

// Capitalizza la prima lettera di ogni parola
const capitalizeWords = (str: string): string => {
  return str
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

// Ottieni tutte le magliette
export const fetchTshirts = async () => {
  return prisma.tshirt.findMany({
    orderBy: [
      { lastName: 'asc' },
      { firstName: 'asc' }
    ]
  });
};

// Ottieni statistiche magliette
export const fetchTshirtStats = async (): Promise<TshirtStats> => {
  const all = await prisma.tshirt.findMany();

  const total = all.length;
  const received = all.filter(t => t.hasReceived).length;
  const pending = total - received;

  // Statistiche per taglia e tipologia
  const bySizeAndType: Record<string, { total: number; received: number; pending: number }> = {};

  for (const tshirt of all) {
    const key = `${tshirt.size}`;
    if (!bySizeAndType[key]) {
      bySizeAndType[key] = { total: 0, received: 0, pending: 0 };
    }
    bySizeAndType[key].total++;
    if (tshirt.hasReceived) {
      bySizeAndType[key].received++;
    } else {
      bySizeAndType[key].pending++;
    }
  }

  return { total, received, pending, bySizeAndType };
};

// Crea una nuova maglietta
export const createTshirt = async (data: TshirtInput) => {
  // Capitalizza nome e cognome
  const firstName = capitalizeWords(data.firstName.trim());
  const lastName = capitalizeWords(data.lastName.trim());

  return prisma.tshirt.create({
    data: {
      firstName,
      lastName,
      size: data.size.toUpperCase(),
      type: data.type
    }
  });
};

// Segna maglietta come consegnata o non consegnata
export const toggleTshirtReceived = async (id: string) => {
  const tshirt = await prisma.tshirt.findUnique({ where: { id } });
  if (!tshirt) {
    throw new AppError("Maglietta non trovata", 404);
  }

  const newStatus = !tshirt.hasReceived;

  return prisma.tshirt.update({
    where: { id },
    data: {
      hasReceived: newStatus,
      receivedAt: newStatus ? new Date() : null
    }
  });
};

// Elimina una maglietta
export const deleteTshirt = async (id: string) => {
  await prisma.tshirt.delete({ where: { id } });
};

// Aggiorna taglia e/o tipologia di una maglietta
export const updateTshirt = async (id: string, data: { size?: string; type?: string }) => {
  const existing = await prisma.tshirt.findUnique({ where: { id } });
  if (!existing) throw new AppError("Maglietta non trovata", 404);

  const nextSize = data.size ? data.size.toUpperCase().trim() : undefined;
  const nextType = data.type?.trim();

  const updated = await prisma.tshirt.update({
    where: { id },
    data: {
      ...(nextSize ? { size: nextSize } : {}),
      ...(typeof nextType === 'string' ? { type: nextType } : {}),
    },
  });

  // Prova ad aggiornare anche su Google Sheets (best-effort)
  try {
    await updateTshirtInGoogleSheet({
      oldFirstName: existing.firstName,
      oldLastName: existing.lastName,
      oldSize: existing.size,
      newFirstName: updated.firstName,
      newLastName: updated.lastName,
      newSize: updated.size,
      newType: updated.type,
    });
  } catch (err: any) {
    logger.error('Errore sync aggiornamento maglietta su Google Sheets:', err.message);
  }

  return updated;
};

// Cerca magliette per nome/cognome (per utenti ENTRANCE - solo PR e Vincitore)
export const searchTshirtsForEntrance = async (query: string) => {
  const normalizedQuery = query.trim().toLowerCase();

  if (normalizedQuery.length < 2) {
    return [];
  }

  // Prendi tutte le magliette e filtra manualmente (SQLite non supporta case-insensitive contains)
  const allTshirts = await prisma.tshirt.findMany({
    orderBy: [
      { lastName: 'asc' },
      { firstName: 'asc' }
    ]
  });

  // Filtra per tipo (PR o Vincitore) e per nome/cognome
  return allTshirts.filter(t => {
    // Normalizza tipologia eliminando spazi extra
    const typeLower = (t.type || '').toString().trim().toLowerCase();
    // Consenti SOLO PR o VINCITORE/VINCENTE (no match parziali come "comprare altre")
    const matchesType = typeLower === 'pr' || typeLower === 'vincitore' || typeLower === 'vincente';
    const matchesSearch =
      t.firstName.toLowerCase().includes(normalizedQuery) ||
      t.lastName.toLowerCase().includes(normalizedQuery);

    return matchesType && matchesSearch;
  });
};

// Cerca tutte le magliette per admin
export const searchTshirts = async (query: string) => {
  const normalizedQuery = query.trim().toLowerCase();

  if (normalizedQuery.length < 2) {
    return [];
  }

  const allTshirts = await prisma.tshirt.findMany({
    orderBy: [
      { lastName: 'asc' },
      { firstName: 'asc' }
    ]
  });

  return allTshirts.filter(t =>
    t.firstName.toLowerCase().includes(normalizedQuery) ||
    t.lastName.toLowerCase().includes(normalizedQuery)
  );
};

// Sincronizza magliette da Google Sheets
export const syncTshirtsFromGoogleSheets = async (opts?: { pruneMissing?: boolean }) => {
  logger.info('Inizio sincronizzazione magliette da Google Sheets');

  try {
    // Leggi dal foglio Google
    const sheetTshirts = await readTshirtsSheet();

    let newImported = 0;
    let alreadyExists = 0;

    const sheetKeys = new Set<string>();
    for (const sheetTshirt of sheetTshirts) {
      const key = `${sheetTshirt.lastName}|${sheetTshirt.firstName}|${sheetTshirt.size}`.toLowerCase();
      sheetKeys.add(key);
      // Cerca se esiste già (stesso nome, cognome, taglia)
      const existing = await prisma.tshirt.findFirst({
        where: {
          firstName: sheetTshirt.firstName,
          lastName: sheetTshirt.lastName,
          size: sheetTshirt.size
        }
      });

      if (existing) {
        alreadyExists++;
        // Aggiorna il tipo se è cambiato
        if (existing.type !== sheetTshirt.type) {
          await prisma.tshirt.update({
            where: { id: existing.id },
            data: { type: sheetTshirt.type }
          });
        }
      } else {
        // Crea nuova maglietta
        await prisma.tshirt.create({
          data: {
            firstName: sheetTshirt.firstName,
            lastName: sheetTshirt.lastName,
            size: sheetTshirt.size,
            type: sheetTshirt.type
          }
        });
        newImported++;
      }
    }

    // Rimuovi mancanti se richiesto
    if (opts?.pruneMissing) {
      const all = await prisma.tshirt.findMany({ select: { id: true, firstName: true, lastName: true, size: true } });
      let deleted = 0;
      for (const t of all) {
        const key = `${t.lastName}|${t.firstName}|${t.size}`.toLowerCase();
        if (!sheetKeys.has(key)) {
          await prisma.tshirt.delete({ where: { id: t.id } });
          deleted++;
        }
      }
      logger.info(`Allineamento magliette: rimossi ${deleted} elementi mancanti nel foglio`);
    }

    logger.info(`Sincronizzazione magliette completata: ${newImported} nuove, ${alreadyExists} esistenti`);

    return {
      success: true,
      newImported,
      alreadyExists
    };

  } catch (error: any) {
    logger.error('Errore sincronizzazione magliette:', error.message);
    throw new AppError(`Errore sincronizzazione magliette: ${error.message}`, 500);
  }
};

// Scrivi una maglietta su Google Sheets (usato quando si crea dall'app o dall'app QR)
export const writeTshirtToSheets = async (firstName: string, lastName: string, size: string, type: string) => {
  try {
    await writeTshirtToGoogleSheet(firstName, lastName, size, type);
    logger.info(`Maglietta scritta su Google Sheets: ${lastName} ${firstName}`);
  } catch (error: any) {
    logger.error('Errore scrittura maglietta su Google Sheets:', error.message);
    throw new AppError(`Errore scrittura su Google Sheets: ${error.message}`, 500);
  }
};
