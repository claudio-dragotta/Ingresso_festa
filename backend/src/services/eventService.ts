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
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

export const PAYMENT_TYPES = ["paypal", "contanti", "p2p", "bonifico"];

export const ALL_SHEET_TABS = ["Lista", "GREEN", "Magliette", "Navette Andata", "Navette Ritorno"] as const;
export type SheetTab = (typeof ALL_SHEET_TABS)[number];

/**
 * Configura un Google Sheet esistente aggiungendo i tab e le intestazioni
 * per i tab selezionati. Salta i tab già esistenti.
 * Lista: 3 colonne con dropdown pagamento su colonna B.
 */
export async function setupGoogleSheet(spreadsheetId: string, tabs: SheetTab[]): Promise<void> {
  const sheets = getSheetsClient();

  // Recupera i tab esistenti e i loro sheetId
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existingSheets = meta.data.sheets ?? [];
  const existingByTitle = new Map(
    existingSheets.map((s) => [s.properties?.title ?? "", s.properties?.sheetId ?? 0])
  );

  const TAB_DEFS: Record<SheetTab, { headers: string[] | null }> = {
    "Lista":          { headers: ["Cognome Nome", "Tipologia Pagamento", "Check"] },
    "GREEN":          { headers: ["Cognome Nome"] },
    "Magliette":      { headers: ["Nome", "Cognome", "Taglia", "Tipologia"] },
    "Navette Andata": { headers: null },
    "Navette Ritorno":{ headers: null },
  };

  const toAdd = tabs.filter((t) => !existingByTitle.has(t));

  // Tab da eliminare: esistono, sono tab "noti" (Lista/GREEN/Magliette/ecc.) ma non sono selezionati
  const knownTabTitles = new Set<string>(Object.keys(TAB_DEFS));
  const toDelete = existingSheets.filter((s) => {
    const title = s.properties?.title ?? "";
    return knownTabTitles.has(title) && !tabs.includes(title as SheetTab);
  });

  // Rinomina "Sheet1" se "Lista" va aggiunto
  if (toAdd.length > 0) {
    const firstSheet = existingSheets[0];
    const firstTitle = firstSheet?.properties?.title;
    const firstId = firstSheet?.properties?.sheetId;
    const requests: any[] = [];

    for (const tab of toAdd) {
      if (tab === "Lista" && firstTitle === "Sheet1" && firstId !== undefined) {
        requests.push({ updateSheetProperties: { properties: { sheetId: firstId, title: "Lista" }, fields: "title" } });
      } else {
        requests.push({ addSheet: { properties: { title: tab } } });
      }
    }

    await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
  }

  // Aggiorna la mappa con i nuovi sheetId
  const metaAfter = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetIdByTitle = new Map(
    (metaAfter.data.sheets ?? []).map((s) => [s.properties?.title ?? "", s.properties?.sheetId ?? 0])
  );

  // Scrivi intestazioni per i tab appena aggiunti
  const headerData = toAdd
    .filter((t) => TAB_DEFS[t].headers !== null)
    .map((t) => {
      const colLetter = String.fromCharCode(64 + TAB_DEFS[t].headers!.length);
      return { range: `${t}!A1:${colLetter}1`, values: [TAB_DEFS[t].headers!] };
    });

  if (headerData.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: { valueInputOption: "RAW", data: headerData },
    });
  }

  // Aggiungi dropdown "Tipologia Pagamento" sulla colonna B del tab Lista (se presente nei tab richiesti)
  if (tabs.includes("Lista") && sheetIdByTitle.has("Lista")) {
    const listaSheetId = sheetIdByTitle.get("Lista")!;
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            setDataValidation: {
              range: {
                sheetId: listaSheetId,
                startRowIndex: 1,      // dalla riga 2 in poi (riga 1 = intestazione)
                startColumnIndex: 1,   // colonna B
                endColumnIndex: 2,
              },
              rule: {
                condition: {
                  type: "ONE_OF_LIST",
                  values: PAYMENT_TYPES.map((v) => ({ userEnteredValue: v })),
                },
                showCustomUi: true,
                strict: false,
              },
            },
          },
        ],
      },
    });
  }

  // Elimina i tab non selezionati DOPO aver aggiunto quelli nuovi
  // (così il foglio non rimane mai con 0 tab)
  if (toDelete.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: toDelete.map((s) => ({
          deleteSheet: { sheetId: s.properties?.sheetId },
        })),
      },
    });
    logger.info(`Tab eliminati dal foglio: ${toDelete.map((s) => s.properties?.title).join(", ")}`);
  }

  logger.info(`Sheet ${spreadsheetId} configurato con tab: ${tabs.join(", ")}`);
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
  googleSheetId?: string
) => {
  const event = await prisma.event.create({
    data: {
      name,
      date: date ?? null,
      googleSheetId: googleSheetId ?? null,
      modules: JSON.stringify(modules),
      status: "ACTIVE",
    },
  });

  // Se è stato fornito uno Sheet ID, configura automaticamente i tab in base ai moduli
  if (googleSheetId) {
    try {
      const tabs: SheetTab[] = ["Lista", "GREEN"];
      if (modules.includes("tshirts")) tabs.push("Magliette");
      if (modules.includes("shuttles")) { tabs.push("Navette Andata"); tabs.push("Navette Ritorno"); }
      await setupGoogleSheet(googleSheetId, tabs);
    } catch (err: any) {
      logger.warn(`Impossibile configurare Sheet ${googleSheetId}: ${err.message}`);
    }
  }

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

  // Cascade delete manuale (SQLite non ha onDelete: Cascade sulle relazioni)
  // 1. ShuttleAssignment (dipende da ShuttleSlot e ShuttleMachine)
  const slots = await prisma.shuttleSlot.findMany({ where: { eventId }, select: { id: true } });
  const machines = await prisma.shuttleMachine.findMany({ where: { eventId }, select: { id: true } });
  if (slots.length > 0) {
    await prisma.shuttleAssignment.deleteMany({ where: { slotId: { in: slots.map(s => s.id) } } });
  }
  if (machines.length > 0) {
    await prisma.shuttleAssignment.deleteMany({ where: { machineId: { in: machines.map(m => m.id) } } });
  }
  // 2. ShuttleSlot e ShuttleMachine
  await prisma.shuttleSlot.deleteMany({ where: { eventId } });
  await prisma.shuttleMachine.deleteMany({ where: { eventId } });
  // 3. CheckInLog (ha eventId nullable)
  await prisma.checkInLog.deleteMany({ where: { eventId } });
  // 4. Invitees (dopo aver eliminato i CheckInLog che li referenziano)
  await prisma.invitee.deleteMany({ where: { eventId } });
  // 5. Tshirts, Expenses, UserEventAccess
  await prisma.tshirt.deleteMany({ where: { eventId } });
  await prisma.expense.deleteMany({ where: { eventId } });
  await prisma.userEventAccess.deleteMany({ where: { eventId } });
  // 6. Finalmente elimina l'evento
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
