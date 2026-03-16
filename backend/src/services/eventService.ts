import { EventStatus, UserRole } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../utils/errors";
import { google } from "googleapis";
import { config } from "../config";
import { logger } from "../logger";

// Moduli disponibili per una festa
export type EventModule = "tshirts" | "expenses" | "shuttles";
export const ALL_MODULES: EventModule[] = ["tshirts", "expenses", "shuttles"];

function parseModules(raw: string): EventModule[] {
  try {
    return JSON.parse(raw) as EventModule[];
  } catch {
    return [];
  }
}

function getSheetsClient() {
  const credentialsJson = config.googleSheets.credentials;
  if (!credentialsJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON non configurato");
  const credentials = JSON.parse(credentialsJson);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive.file",
    ],
  });
  return google.sheets({ version: "v4", auth });
}

/**
 * Crea un nuovo Google Spreadsheet per la festa con i tab appropriati in base ai moduli.
 * Restituisce l'ID del nuovo spreadsheet.
 */
async function createGoogleSheet(eventName: string, modules: EventModule[]): Promise<string> {
  const sheets = getSheetsClient();

  // Tab sempre presenti: Lista (paganti) e GREEN
  const sheetTitles = ["Lista", "GREEN"];

  if (modules.includes("tshirts")) sheetTitles.push("Magliette");
  if (modules.includes("shuttles")) {
    sheetTitles.push("Navette Andata");
    sheetTitles.push("Navette Ritorno");
  }

  const response = await sheets.spreadsheets.create({
    requestBody: {
      properties: {
        title: eventName,
      },
      sheets: sheetTitles.map((title) => ({
        properties: { title },
      })),
    },
  });

  const spreadsheetId = response.data.spreadsheetId;
  if (!spreadsheetId) throw new Error("Impossibile creare Google Sheet: ID non ricevuto");

  // Aggiungi intestazioni ai tab
  const data: { range: string; values: string[][] }[] = [
    { range: "Lista!A1:B1", values: [["Cognome Nome", "Tipologia Pagamento"]] },
    { range: "GREEN!A1", values: [["Cognome Nome"]] },
  ];

  if (modules.includes("tshirts")) {
    data.push({ range: "Magliette!A1:D1", values: [["Nome", "Cognome", "Taglia", "Tipologia"]] });
  }

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "RAW",
      data,
    },
  });

  logger.info(`Creato Google Sheet "${eventName}" con ID: ${spreadsheetId}`);
  return spreadsheetId;
}

// ===================== CRUD EVENTI =====================

export const listEvents = async (userId: string, userRole: UserRole) => {
  if (userRole === "ADMIN") {
    // Admin vede tutte le feste
    const events = await prisma.event.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { invitees: true, userAccess: true } },
      },
    });
    return events.map((e) => ({
      ...e,
      modules: parseModules(e.modules),
    }));
  }

  // Gli altri utenti vedono solo le feste a cui sono assegnati
  const accesses = await prisma.userEventAccess.findMany({
    where: { userId },
    include: {
      event: {
        include: {
          _count: { select: { invitees: true } },
        },
      },
    },
    orderBy: { event: { createdAt: "desc" } },
  });

  return accesses.map((a) => ({
    ...a.event,
    modules: parseModules(a.event.modules),
    myRole: a.role,
  }));
};

export const getEvent = async (eventId: string) => {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      _count: { select: { invitees: true, userAccess: true } },
      userAccess: {
        include: {
          user: { select: { id: true, username: true, role: true, active: true } },
        },
      },
    },
  });
  if (!event) throw new AppError("Festa non trovata", 404);
  return { ...event, modules: parseModules(event.modules) };
};

export const createEvent = async (
  name: string,
  date: Date | undefined,
  modules: EventModule[],
  createSheet: boolean
) => {
  let googleSheetId: string | undefined;

  if (createSheet) {
    try {
      googleSheetId = await createGoogleSheet(name, modules);
    } catch (error: any) {
      logger.error("Errore creazione Google Sheet:", error.message);
      throw new AppError(`Impossibile creare Google Sheet: ${error.message}`, 500);
    }
  }

  const event = await prisma.event.create({
    data: {
      name,
      date: date ?? null,
      googleSheetId: googleSheetId ?? null,
      modules: JSON.stringify(modules),
      status: "ACTIVE",
    },
  });

  return { ...event, modules: parseModules(event.modules) };
};

export const updateEvent = async (
  eventId: string,
  data: {
    name?: string;
    date?: Date | null;
    modules?: EventModule[];
    status?: EventStatus;
    googleSheetId?: string | null;
  }
) => {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw new AppError("Festa non trovata", 404);

  const updated = await prisma.event.update({
    where: { id: eventId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.date !== undefined && { date: data.date }),
      ...(data.modules !== undefined && { modules: JSON.stringify(data.modules) }),
      ...(data.status !== undefined && { status: data.status }),
      ...(data.googleSheetId !== undefined && { googleSheetId: data.googleSheetId }),
    },
  });

  return { ...updated, modules: parseModules(updated.modules) };
};

export const deleteEvent = async (eventId: string) => {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw new AppError("Festa non trovata", 404);
  await prisma.event.delete({ where: { id: eventId } });
};

// ===================== ACCESSI UTENTI PER EVENTO =====================

export const listEventUsers = async (eventId: string) => {
  return prisma.userEventAccess.findMany({
    where: { eventId },
    include: {
      user: { select: { id: true, username: true, active: true } },
    },
  });
};

export const assignUserToEvent = async (userId: string, eventId: string, role: UserRole) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError("Utente non trovato", 404);

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw new AppError("Festa non trovata", 404);

  return prisma.userEventAccess.upsert({
    where: { userId_eventId: { userId, eventId } },
    update: { role },
    create: { userId, eventId, role },
    include: {
      user: { select: { id: true, username: true } },
    },
  });
};

export const removeUserFromEvent = async (userId: string, eventId: string) => {
  const access = await prisma.userEventAccess.findUnique({
    where: { userId_eventId: { userId, eventId } },
  });
  if (!access) throw new AppError("Accesso non trovato", 404);
  await prisma.userEventAccess.delete({
    where: { userId_eventId: { userId, eventId } },
  });
};

export const getUserEventRole = async (
  userId: string,
  eventId: string
): Promise<UserRole | null> => {
  const access = await prisma.userEventAccess.findUnique({
    where: { userId_eventId: { userId, eventId } },
  });
  return access?.role ?? null;
};
