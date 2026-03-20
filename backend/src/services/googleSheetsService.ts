import { google } from 'googleapis';
import { logger } from '../logger';
import { config } from '../config';

/**
 * Google Sheets Service
 *
 * Tutte le funzioni accettano spreadsheetId esplicito (per-event).
 * Non usano più il GOOGLE_SHEET_ID globale nelle env var.
 */

export interface ParsedPerson {
  firstName: string;
  lastName: string;
  listType: 'PAGANTE' | 'GREEN';
  paymentType?: string;
  email?: string;
  originalValue: string;
}

export interface ParsedTshirt {
  firstName: string;
  lastName: string;
  size: string;
  type: string;
}

export interface ParsedShuttleAssignment {
  machineName: string;
  slotTime: string;
  fullName: string;
  direction: 'ANDATA' | 'RITORNO';
  cellPosition: { row: number; col: string };
}

function getGoogleSheetsClient() {
  const credentialsJson = config.googleSheets.credentials;
  if (!credentialsJson) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON non configurato');
  let credentials;
  try {
    credentials = JSON.parse(credentialsJson);
  } catch {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON non è un JSON valido');
  }
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

function capitalizeWords(text: string): string {
  return text.toLowerCase().split(' ').map(w => w.length === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// ─── LETTURA LISTA PAGANTI ───────────────────────────────────────────────────

export async function readPagantiSheet(spreadsheetId: string): Promise<Array<{ colA: string; colB?: string; colC?: string }>> {
  // Leggiamo fino alla colonna C: A=nome, B=pagamento, C=email
  const baseRange = config.googleSheets.range;
  // Trasforma "Lista!A:B" → "Lista!A:C" per includere la colonna email
  const range = baseRange.replace(/:[A-Z]+$/, ':C');
  logger.info(`Lettura Google Sheet PAGANTI: ${spreadsheetId}, range: ${range}`);
  const sheets = getGoogleSheetsClient();
  const response = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  const rows = response.data.values;
  if (!rows || rows.length === 0) {
    logger.warn('Google Sheet PAGANTI vuoto');
    return [];
  }
  const HEADER_KEYWORDS = new Set(['nome', 'cognome', 'name', 'pagamento', 'payment', 'tipologia', 'email']);
  const isHeader = (val: string) => HEADER_KEYWORDS.has(val.trim().toLowerCase());
  const data = rows
    .filter(row => row[0]?.toString().trim() && !isHeader(row[0].toString()))
    .map(row => ({
      colA: row[0].toString().trim(),
      colB: row[1] ? row[1].toString().trim().toLowerCase() : undefined,
      colC: row[2] ? row[2].toString().trim().toLowerCase() : undefined,
    }));
  logger.info(`Letti ${data.length} valori PAGANTI`);
  return data;
}

// ─── LETTURA LISTA GREEN ─────────────────────────────────────────────────────

export async function readGreenSheet(spreadsheetId: string): Promise<Array<{ name: string; email?: string }>> {
  // Leggiamo A:B per includere la colonna email (colonna B)
  const greenRange = (process.env.GOOGLE_SHEET_GREEN_RANGE || 'GREEN!A:A').replace(/:[A-Z]+$/, ':B');
  logger.info(`Lettura Google Sheet GREEN: ${spreadsheetId}, range: ${greenRange}`);
  const sheets = getGoogleSheetsClient();
  const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: greenRange });
  const rows = response.data.values;
  if (!rows || rows.length === 0) {
    logger.warn('Google Sheet GREEN vuoto');
    return [];
  }
  const data = rows
    .filter(row => row[0]?.toString().trim())
    .map(row => ({
      name: row[0].toString().trim(),
      email: row[1] ? row[1].toString().trim().toLowerCase() : undefined,
    }));
  logger.info(`Letti ${data.length} valori GREEN`);
  return data;
}

// ─── PARSER NOME ─────────────────────────────────────────────────────────────

export function parsePersonName(fullName: string, listType: 'PAGANTE' | 'GREEN', paymentType?: string, email?: string): ParsedPerson {
  const trimmed = fullName.trim();
  if (!trimmed) throw new Error('Nome vuoto');
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return { lastName: parts[0], firstName: '', listType, paymentType: listType === 'PAGANTE' ? paymentType : undefined, email, originalValue: fullName };
  }
  const firstName = parts.pop()!;
  const lastName = parts.join(' ');
  return { firstName, lastName, listType, paymentType: listType === 'PAGANTE' ? paymentType : undefined, email, originalValue: fullName };
}

// ─── FETCH + PARSE PAGANTI + GREEN ──────────────────────────────────────────

export async function fetchAndParseGoogleSheets(spreadsheetId: string): Promise<ParsedPerson[]> {
  const [pagantiData, greenData] = await Promise.all([
    readPagantiSheet(spreadsheetId).catch(err => { logger.error('Errore lettura PAGANTI:', err); return []; }),
    readGreenSheet(spreadsheetId).catch(err => { logger.error('Errore lettura GREEN:', err); return []; }),
  ]);

  const parsedPersons: ParsedPerson[] = [];
  const errors: string[] = [];

  for (const row of pagantiData) {
    try {
      const person = parsePersonName(row.colA, 'PAGANTE', row.colB, row.colC);
      if (!person.lastName) { errors.push(`Ignorato PAGANTE: "${row.colA}"`); continue; }
      parsedPersons.push(person);
    } catch (error: any) {
      errors.push(`Errore parsing PAGANTE "${row.colA}": ${error.message}`);
    }
  }

  for (const row of greenData) {
    try {
      const person = parsePersonName(row.name, 'GREEN', undefined, row.email);
      if (!person.lastName) { errors.push(`Ignorato GREEN: "${row.name}"`); continue; }
      parsedPersons.push(person);
    } catch (error: any) {
      errors.push(`Errore parsing GREEN "${row.name}": ${error.message}`);
    }
  }

  if (errors.length > 0) logger.warn(`Errori parsing (${errors.length}): ${errors.join(', ')}`);
  logger.info(`Parsate ${parsedPersons.length} persone valide`);
  return parsedPersons;
}

// ─── SCRITTURA INVITATO ──────────────────────────────────────────────────────

export async function writeToGoogleSheet(spreadsheetId: string, fullName: string, listType: 'PAGANTE' | 'GREEN', paymentType?: string, email?: string): Promise<void> {
  const formattedName = capitalizeWords(fullName.trim());
  const formattedPaymentType = paymentType ? paymentType.trim().toLowerCase() : '';
  const formattedEmail = email ? email.trim().toLowerCase() : '';
  const sheets = getGoogleSheetsClient();

  if (listType === 'PAGANTE') {
    // Colonne: A=nome, B=pagamento, C=email
    await sheets.spreadsheets.values.append({
      spreadsheetId, range: 'Lista!A:C', valueInputOption: 'RAW', insertDataOption: 'OVERWRITE',
      requestBody: { values: [[formattedName, formattedPaymentType, formattedEmail]] },
    });
    logger.info(`Scritto su PAGANTI: ${formattedName} | ${formattedPaymentType || 'N/D'} | ${formattedEmail || 'no email'}`);
  } else {
    // Colonne: A=nome, B=email
    const greenRangeBase = process.env.GOOGLE_SHEET_GREEN_RANGE || 'GREEN!A:A';
    const greenRange = greenRangeBase.replace(/:[A-Z]+$/, ':B');
    await sheets.spreadsheets.values.append({
      spreadsheetId, range: greenRange, valueInputOption: 'RAW', insertDataOption: 'OVERWRITE',
      requestBody: { values: [[formattedName, formattedEmail]] },
    });
    logger.info(`Scritto su GREEN: ${formattedName} | ${formattedEmail || 'no email'}`);
  }
}

// ─── MAGLIETTE ───────────────────────────────────────────────────────────────

export async function readTshirtsSheet(spreadsheetId: string): Promise<ParsedTshirt[]> {
  const range = 'Magliette!A2:D';
  logger.info(`Lettura Google Sheet MAGLIETTE: ${spreadsheetId}`);
  const sheets = getGoogleSheetsClient();
  const response = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  const rows = response.data.values;
  if (!rows || rows.length === 0) { logger.warn('Google Sheet MAGLIETTE vuoto'); return []; }
  const data = rows
    .filter(row => row[0] && row[1] && row[2])
    .map(row => ({
      firstName: capitalizeWords(row[0]?.toString().trim() || ''),
      lastName: capitalizeWords(row[1]?.toString().trim() || ''),
      size: row[2]?.toString().trim().toUpperCase() || '',
      type: row[3]?.toString().trim() || '',
    }));
  logger.info(`Lette ${data.length} magliette`);
  return data;
}

export async function writeTshirtToGoogleSheet(spreadsheetId: string, firstName: string, lastName: string, size: string, type: string): Promise<void> {
  const sheets = getGoogleSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId, range: 'Magliette!A:D', valueInputOption: 'RAW', insertDataOption: 'OVERWRITE',
    requestBody: { values: [[capitalizeWords(firstName.trim()), capitalizeWords(lastName.trim()), size.trim().toUpperCase(), type.trim()]] },
  });
  logger.info(`Scritta maglietta: ${lastName} ${firstName} | ${size} | ${type}`);
}

export async function updateTshirtInGoogleSheet(spreadsheetId: string, params: {
  oldFirstName: string; oldLastName: string; oldSize?: string;
  newFirstName?: string; newLastName?: string; newSize?: string; newType?: string;
}): Promise<void> {
  const sheets = getGoogleSheetsClient();
  const range = 'Magliette!A2:D';
  const nextFirstName = capitalizeWords((params.newFirstName ?? params.oldFirstName).trim());
  const nextLastName = capitalizeWords((params.newLastName ?? params.oldLastName).trim());
  const nextSize = (params.newSize ?? params.oldSize ?? '').trim().toUpperCase();
  const nextType = (params.newType ?? '').trim();

  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  const rows = res.data.values || [];
  let rowIndex: number | null = null;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] || [];
    const f = (row[0] || '').toString().trim();
    const l = (row[1] || '').toString().trim();
    const s = (row[2] || '').toString().trim().toUpperCase();
    if (
      f.localeCompare(params.oldFirstName, undefined, { sensitivity: 'accent' }) === 0 &&
      l.localeCompare(params.oldLastName, undefined, { sensitivity: 'accent' }) === 0 &&
      (!params.oldSize || s === params.oldSize.toUpperCase())
    ) { rowIndex = i; break; }
  }

  if (rowIndex === null) {
    await sheets.spreadsheets.values.append({
      spreadsheetId, range: 'Magliette!A:D', valueInputOption: 'RAW', insertDataOption: 'OVERWRITE',
      requestBody: { values: [[nextFirstName, nextLastName, nextSize, nextType]] },
    });
    logger.warn(`Riga Magliette non trovata per ${params.oldLastName} ${params.oldFirstName}. Eseguito append.`);
    return;
  }

  const absoluteRow = rowIndex + 2;
  await sheets.spreadsheets.values.update({
    spreadsheetId, range: `Magliette!A${absoluteRow}:D${absoluteRow}`, valueInputOption: 'RAW',
    requestBody: { values: [[nextFirstName, nextLastName, nextSize, nextType]] },
  });
  logger.info(`Aggiornata riga Magliette ${absoluteRow}: ${nextLastName} ${nextFirstName}`);
}

// ─── NAVETTE ─────────────────────────────────────────────────────────────────

export async function readShuttlesSheet(spreadsheetId: string, direction: 'ANDATA' | 'RITORNO'): Promise<ParsedShuttleAssignment[]> {
  const sheetName = direction === 'ANDATA'
    ? config.googleSheets.shuttlesOutboundSheetName || 'Navette Andata'
    : config.googleSheets.shuttlesReturnSheetName || 'Navette Ritorno';
  const range = `${sheetName}!A1:ZZ20`;
  logger.info(`Lettura NAVETTE ${direction}: ${spreadsheetId}`);
  const sheets = getGoogleSheetsClient();
  const response = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  const rows = response.data.values;
  if (!rows || rows.length === 0) { logger.warn(`Sheet NAVETTE ${direction} vuoto`); return []; }

  const assignments: ParsedShuttleAssignment[] = [];
  const timeRow = rows[0] || [];
  const times: string[] = [];
  for (let colIdx = 1; colIdx < timeRow.length; colIdx++) {
    const time = timeRow[colIdx]?.toString().trim();
    if (time) times.push(time);
  }
  if (times.length === 0) { logger.warn(`Nessun orario trovato in ${sheetName}`); return []; }

  const machineGroups = [
    { name: 'MACCHINA 1', startRow: 1, endRow: 4 },
    { name: 'MACCHINA 2', startRow: 5, endRow: 8 },
    { name: 'MACCHINA 3', startRow: 9, endRow: 12 },
  ];

  for (const machine of machineGroups) {
    const machineName = rows[machine.startRow]?.[0]?.toString().trim() || machine.name;
    for (let timeIdx = 0; timeIdx < times.length; timeIdx++) {
      const colIdx = timeIdx + 1;
      const slotTime = times[timeIdx];
      const colLetter = String.fromCharCode(66 + timeIdx);
      for (let seatOffset = 0; seatOffset < 4; seatOffset++) {
        const rowIdx = machine.startRow + seatOffset;
        if (rowIdx >= rows.length) continue;
        const fullName = rows[rowIdx]?.[colIdx]?.toString().trim();
        if (fullName) {
          assignments.push({ machineName, slotTime, fullName, direction, cellPosition: { row: rowIdx + 1, col: colLetter } });
        }
      }
    }
  }

  logger.info(`Parsate ${assignments.length} assegnazioni navette ${direction}`);
  return assignments;
}

export async function updateShuttleCellInGoogleSheet(spreadsheetId: string, direction: 'ANDATA' | 'RITORNO', cellPosition: { row: number; col: string }, fullName: string): Promise<void> {
  const sheetName = direction === 'ANDATA'
    ? config.googleSheets.shuttlesOutboundSheetName || 'Navette Andata'
    : config.googleSheets.shuttlesReturnSheetName || 'Navette Ritorno';
  const cellRange = `${sheetName}!${cellPosition.col}${cellPosition.row}`;
  const formattedName = fullName.trim() ? capitalizeWords(fullName.trim()) : '';
  const sheets = getGoogleSheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId, range: cellRange, valueInputOption: 'RAW',
    requestBody: { values: [[formattedName]] },
  });
  logger.info(`Aggiornata cella navette ${direction} ${cellRange}: "${formattedName}"`);
}

export async function readShuttleTimesFromSheet(spreadsheetId: string, direction: 'ANDATA' | 'RITORNO'): Promise<string[]> {
  const sheetName = direction === 'ANDATA'
    ? config.googleSheets.shuttlesOutboundSheetName || 'Navette Andata'
    : config.googleSheets.shuttlesReturnSheetName || 'Navette Ritorno';
  const sheets = getGoogleSheetsClient();
  const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${sheetName}!B1:ZZ1` });
  const timeRow = response.data.values?.[0] || [];
  return timeRow.map((t: any) => t?.toString().trim()).filter(Boolean);
}

export async function deleteShuttleSlotFromSheet(spreadsheetId: string, direction: 'ANDATA' | 'RITORNO', time: string): Promise<void> {
  const sheetName = direction === 'ANDATA'
    ? config.googleSheets.shuttlesOutboundSheetName || 'Navette Andata'
    : config.googleSheets.shuttlesReturnSheetName || 'Navette Ritorno';
  const sheets = getGoogleSheetsClient();

  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const sheet = spreadsheet.data.sheets?.find(s => s.properties?.title === sheetName);
  if (!sheet?.properties?.sheetId) throw new Error(`Foglio ${sheetName} non trovato`);
  const sheetId = sheet.properties.sheetId;

  const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${sheetName}!B1:ZZ1` });
  const timeRow = response.data.values?.[0] || [];
  let columnIndex = -1;
  for (let i = 0; i < timeRow.length; i++) {
    if (timeRow[i]?.toString().trim() === time.trim()) { columnIndex = i + 1; break; }
  }
  if (columnIndex === -1) throw new Error(`Orario ${time} non trovato nel foglio ${sheetName}`);

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: [{ deleteDimension: { range: { sheetId, dimension: 'COLUMNS', startIndex: columnIndex, endIndex: columnIndex + 1 } } }] },
  });
  logger.info(`Eliminata colonna ${columnIndex} (orario ${time}) da ${sheetName}`);
}

// ─── ELIMINAZIONE RIGA INVITATO DAL FOGLIO ───────────────────────────────────

export async function deleteInviteeFromSheet(
  spreadsheetId: string,
  fullName: string,
  listType: 'PAGANTE' | 'GREEN'
): Promise<void> {
  const sheets = getGoogleSheetsClient();

  const sheetName = listType === 'PAGANTE' ? 'Lista' : 'GREEN';

  // Legge tutta la colonna A dall'inizio (riga 1) così l'indice corrisponde
  // esattamente all'indice 0-based usato da deleteDimension
  const fullRange = `${sheetName}!A:A`;
  const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: fullRange });
  const rows = response.data.values;
  if (!rows || rows.length === 0) return;

  const rowIndex = rows.findIndex(row => {
    const cell = row[0]?.toString().trim().toLowerCase();
    return cell === fullName.toLowerCase();
  });
  if (rowIndex === -1) {
    logger.warn(`Invitato "${fullName}" non trovato nel foglio ${sheetName}`);
    return;
  }

  // Recupera sheetId numerico per la tab
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheet = meta.data.sheets?.find(s => s.properties?.title === sheetName);
  const sheetId = sheet?.properties?.sheetId;
  if (sheetId === undefined) {
    logger.warn(`Tab "${sheetName}" non trovata nel foglio`);
    return;
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId,
            dimension: 'ROWS',
            startIndex: rowIndex,
            endIndex: rowIndex + 1,
          },
        },
      }],
    },
  });

  logger.info(`Riga "${fullName}" eliminata dal foglio ${sheetName}`);
}

// ─── TEST CONNESSIONE (usa sheet globale per test) ───────────────────────────

export async function testGoogleSheetsConnection(spreadsheetId?: string): Promise<boolean> {
  const sheetId = spreadsheetId || config.googleSheets.spreadsheetId;
  if (!sheetId) return false;
  try {
    await readPagantiSheet(sheetId);
    logger.info('Connessione Google Sheets OK');
    return true;
  } catch (error: any) {
    logger.error('Test connessione Google Sheets fallito:', error.message);
    return false;
  }
}
