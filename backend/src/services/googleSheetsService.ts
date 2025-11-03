import { google } from 'googleapis';
import { logger } from '../logger';
import { config } from '../config';

/**
 * Google Sheets Service
 *
 * Gestisce la lettura automatica dal foglio Google configurato.
 * Supporta due tabelle:
 * - Lista (paganti): Colonne A (Cognome Nome) e B (Tipologia Pagamento)
 * - GREEN (non paganti): Colonna A (Cognome Nome)
 */

interface GoogleSheetsConfig {
  spreadsheetId: string;
  range: string; // es: "Lista!A2:B" (legge dalla riga 2 in poi, colonne A e B)
  greenRange?: string; // es: "GREEN!A:A"
  credentials: string; // JSON Service Account
}

export interface ParsedPerson {
  firstName: string;
  lastName: string;
  listType: 'PAGANTE' | 'GREEN';
  paymentType?: string; // Solo per PAGANTE
  originalValue: string; // Valore originale dalla cella
}

/**
 * Inizializza il client Google Sheets con Service Account
 */
function getGoogleSheetsClient() {
  const credentialsJson = config.googleSheets.credentials;

  if (!credentialsJson) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON non configurato');
  }

  let credentials;
  try {
    credentials = JSON.parse(credentialsJson);
  } catch (error) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON non è un JSON valido');
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'], // Read + Write access
  });

  return google.sheets({ version: 'v4', auth });
}

/**
 * Legge i dati dalle colonne A e B del foglio Google (Lista PAGANTI)
 * @returns Array di righe: [nome, tipologia pagamento]
 */
export async function readPagantiSheet(): Promise<Array<{colA: string, colB?: string}>> {
  const { spreadsheetId, range } = config.googleSheets;

  if (!spreadsheetId) {
    throw new Error('GOOGLE_SHEET_ID non configurato');
  }

  logger.info(`Lettura Google Sheet PAGANTI: ${spreadsheetId}, range: ${range}`);

  const sheets = getGoogleSheetsClient();

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const rows = response.data.values;

    if (!rows || rows.length === 0) {
      logger.warn('Google Sheet PAGANTI vuoto o nessun dato nel range specificato');
      return [];
    }

    // Estrai colonna A (nome) e colonna B (tipologia pagamento)
    const data = rows
      .filter(row => row[0]?.toString().trim()) // Solo righe con colonna A non vuota
      .map(row => ({
        colA: row[0]?.toString().trim(),
        colB: row[1] ? row[1].toString().trim().toLowerCase() : undefined, // Tipologia pagamento (opzionale)
      }));

    logger.info(`Letti ${data.length} valori PAGANTI dal Google Sheet`);
    return data;

  } catch (error: any) {
    logger.error('Errore lettura Google Sheet PAGANTI:', error.message);
    throw new Error(`Impossibile leggere Google Sheet PAGANTI: ${error.message}`);
  }
}

/**
 * Legge i dati dalla colonna A del foglio GREEN (non paganti)
 * @returns Array di nomi
 */
export async function readGreenSheet(): Promise<string[]> {
  const { spreadsheetId } = config.googleSheets;
  const greenRange = process.env.GOOGLE_SHEET_GREEN_RANGE || 'GREEN!A:A';

  if (!spreadsheetId) {
    throw new Error('GOOGLE_SHEET_ID non configurato');
  }

  logger.info(`Lettura Google Sheet GREEN: ${spreadsheetId}, range: ${greenRange}`);

  const sheets = getGoogleSheetsClient();

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: greenRange,
    });

    const rows = response.data.values;

    if (!rows || rows.length === 0) {
      logger.warn('Google Sheet GREEN vuoto o nessun dato nel range specificato');
      return [];
    }

    // Estrai colonna A (nome)
    const data = rows
      .filter(row => row[0]?.toString().trim()) // Solo righe con colonna A non vuota
      .map(row => row[0]?.toString().trim());

    logger.info(`Letti ${data.length} valori GREEN dal Google Sheet`);
    return data;

  } catch (error: any) {
    logger.error('Errore lettura Google Sheet GREEN:', error.message);
    throw new Error(`Impossibile leggere Google Sheet GREEN: ${error.message}`);
  }
}

/**
 * Parser per formato "Cognome Nome"
 *
 * Esempi:
 * - "Rossi Mario" -> { lastName: "Rossi", firstName: "Mario" }
 * - "De Luca Anna" -> { lastName: "De Luca", firstName: "Anna" }
 * - "Van Der Berg Jan" -> { lastName: "Van Der Berg", firstName: "Jan" }
 *
 * Strategia:
 * - Splitta per spazi
 * - L'ultima parola è il nome (firstName)
 * - Tutto il resto è il cognome (lastName)
 */
export function parsePersonName(fullName: string, listType: 'PAGANTE' | 'GREEN', paymentType?: string): ParsedPerson {
  const trimmed = fullName.trim();

  if (!trimmed) {
    throw new Error('Nome vuoto');
  }

  const parts = trimmed.split(/\s+/); // Split per uno o più spazi

  if (parts.length === 1) {
    // Solo una parola: consideriamola come cognome
    return {
      lastName: parts[0],
      firstName: '',
      listType,
      paymentType: listType === 'PAGANTE' ? paymentType : undefined,
      originalValue: fullName,
    };
  }

  // L'ultima parola è il nome, il resto è il cognome
  const firstName = parts.pop()!; // Ultima parola
  const lastName = parts.join(' '); // Tutto il resto unito

  return {
    firstName,
    lastName,
    listType,
    paymentType: listType === 'PAGANTE' ? paymentType : undefined,
    originalValue: fullName,
  };
}

/**
 * Legge e parsa tutte le persone da entrambi i fogli Google (PAGANTI e GREEN)
 * @returns Array di persone parsate con tipo lista e tipologia pagamento
 */
export async function fetchAndParseGoogleSheets(): Promise<ParsedPerson[]> {
  const [pagantiData, greenData] = await Promise.all([
    readPagantiSheet().catch(err => {
      logger.error('Errore lettura PAGANTI:', err);
      return [];
    }),
    readGreenSheet().catch(err => {
      logger.error('Errore lettura GREEN:', err);
      return [];
    }),
  ]);

  const parsedPersons: ParsedPerson[] = [];
  const errors: string[] = [];

  // Parsa PAGANTI
  for (const row of pagantiData) {
    try {
      const person = parsePersonName(row.colA, 'PAGANTE', row.colB);

      // Validazione: almeno cognome deve essere presente
      if (!person.lastName) {
        errors.push(`Ignorato PAGANTE: "${row.colA}" (cognome mancante)`);
        continue;
      }

      parsedPersons.push(person);
    } catch (error: any) {
      errors.push(`Errore parsing PAGANTE "${row.colA}": ${error.message}`);
    }
  }

  // Parsa GREEN
  for (const name of greenData) {
    try {
      const person = parsePersonName(name, 'GREEN');

      // Validazione: almeno cognome deve essere presente
      if (!person.lastName) {
        errors.push(`Ignorato GREEN: "${name}" (cognome mancante)`);
        continue;
      }

      parsedPersons.push(person);
    } catch (error: any) {
      errors.push(`Errore parsing GREEN "${name}": ${error.message}`);
    }
  }

  if (errors.length > 0) {
    logger.warn(`Errori parsing Google Sheets (${errors.length}): ${errors.join(', ')}`);
  }

  logger.info(`Parsate ${parsedPersons.length} persone valide da Google Sheets (${pagantiData.length} PAGANTI, ${greenData.length} GREEN)`);
  return parsedPersons;
}

/**
 * Verifica connessione a Google Sheets (test)
 */
export async function testGoogleSheetsConnection(): Promise<boolean> {
  try {
    await Promise.all([
      readPagantiSheet(),
      readGreenSheet(),
    ]);
    logger.info('Connessione Google Sheets OK');
    return true;
  } catch (error: any) {
    logger.error('Test connessione Google Sheets fallito:', error.message);
    return false;
  }
}

/**
 * Capitalizza la prima lettera di ogni parola
 * Esempio: "mario rossi" -> "Mario Rossi"
 */
function capitalizeWords(text: string): string {
  return text
    .toLowerCase()
    .split(' ')
    .map(word => {
      if (word.length === 0) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

/**
 * Scrive una nuova riga nel Google Sheet appropriato
 * @param fullName Nome completo formato "Cognome Nome"
 * @param listType Tipo lista (PAGANTE o GREEN)
 * @param paymentType Tipologia pagamento (solo per PAGANTE)
 */
export async function writeToGoogleSheet(fullName: string, listType: 'PAGANTE' | 'GREEN', paymentType?: string): Promise<void> {
  const { spreadsheetId } = config.googleSheets;

  if (!spreadsheetId) {
    throw new Error('GOOGLE_SHEET_ID non configurato');
  }

  // Formatta il nome con iniziali maiuscole
  const formattedName = capitalizeWords(fullName.trim());

  // Formatta il tipo di pagamento in minuscolo (se presente)
  const formattedPaymentType = paymentType ? paymentType.trim().toLowerCase() : '';

  const sheets = getGoogleSheetsClient();

  try {
    if (listType === 'PAGANTE') {
      // Scrivi su foglio Lista: Colonna A = Cognome Nome, Colonna B = Tipo Pagamento
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'Lista!A:B',
        valueInputOption: 'RAW',
        insertDataOption: 'OVERWRITE', // Scrive dopo l'ultima cella con contenuto, non dopo righe formattate vuote
        requestBody: {
          values: [[formattedName, formattedPaymentType]],
        },
      });
      logger.info(`Scritto su Google Sheet PAGANTI: ${formattedName} | ${formattedPaymentType || 'N/D'}`);
    } else {
      // Scrivi su foglio GREEN: Solo Colonna A = Cognome Nome
      const greenRange = process.env.GOOGLE_SHEET_GREEN_RANGE || 'GREEN!A:A';
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: greenRange,
        valueInputOption: 'RAW',
        insertDataOption: 'OVERWRITE', // Scrive dopo l'ultima cella con contenuto, non dopo righe formattate vuote
        requestBody: {
          values: [[formattedName]],
        },
      });
      logger.info(`Scritto su Google Sheet GREEN: ${formattedName}`);
    }
  } catch (error: any) {
    logger.error('Errore scrittura Google Sheet:', error.message);
    throw new Error(`Impossibile scrivere su Google Sheet: ${error.message}`);
  }
}

/**
 * MAGLIETTE - Legge i dati dal foglio "Magliette"
 * Colonne: A=Nome, B=Cognome, C=Taglia, D=Tipologia
 * @returns Array di magliette
 */
export interface ParsedTshirt {
  firstName: string;
  lastName: string;
  size: string;
  type: string;
}

export async function readTshirtsSheet(): Promise<ParsedTshirt[]> {
  const { spreadsheetId } = config.googleSheets;

  if (!spreadsheetId) {
    throw new Error('GOOGLE_SHEET_ID non configurato');
  }

  const range = 'Magliette!A2:D'; // Dalla riga 2 (salta intestazione)

  logger.info(`Lettura Google Sheet MAGLIETTE: ${spreadsheetId}, range: ${range}`);

  const sheets = getGoogleSheetsClient();

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const rows = response.data.values;

    if (!rows || rows.length === 0) {
      logger.warn('Google Sheet MAGLIETTE vuoto o nessun dato nel range specificato');
      return [];
    }

    // Estrai colonne A (Nome), B (Cognome), C (Taglia), D (Tipologia)
    const data = rows
      .filter(row => row[0] && row[1] && row[2]) // Nome, Cognome, Taglia obbligatori
      .map(row => ({
        firstName: capitalizeWords(row[0]?.toString().trim() || ''),
        lastName: capitalizeWords(row[1]?.toString().trim() || ''),
        size: row[2]?.toString().trim().toUpperCase() || '',
        type: row[3]?.toString().trim() || '',
      }));

    logger.info(`Lette ${data.length} magliette dal Google Sheet`);
    return data;

  } catch (error: any) {
    logger.error('Errore lettura Google Sheet MAGLIETTE:', error.message);
    throw new Error(`Impossibile leggere Google Sheet MAGLIETTE: ${error.message}`);
  }
}

/**
 * Scrive una nuova maglietta nel foglio "Magliette"
 * @param firstName Nome
 * @param lastName Cognome
 * @param size Taglia
 * @param type Tipologia
 */
export async function writeTshirtToGoogleSheet(firstName: string, lastName: string, size: string, type: string): Promise<void> {
  const { spreadsheetId } = config.googleSheets;

  if (!spreadsheetId) {
    throw new Error('GOOGLE_SHEET_ID non configurato');
  }

  // Formatta con iniziali maiuscole
  const formattedFirstName = capitalizeWords(firstName.trim());
  const formattedLastName = capitalizeWords(lastName.trim());
  const formattedSize = size.trim().toUpperCase();
  const formattedType = type.trim();

  const sheets = getGoogleSheetsClient();

  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Magliette!A:D',
      valueInputOption: 'RAW',
      insertDataOption: 'OVERWRITE',
      requestBody: {
        values: [[formattedFirstName, formattedLastName, formattedSize, formattedType]],
      },
    });
    logger.info(`Scritta maglietta su Google Sheet: ${formattedLastName} ${formattedFirstName} | ${formattedSize} | ${formattedType}`);
  } catch (error: any) {
    logger.error('Errore scrittura maglietta su Google Sheet:', error.message);
    throw new Error(`Impossibile scrivere maglietta su Google Sheet: ${error.message}`);
  }
}

/**
 * Aggiorna una riga esistente nel foglio "Magliette" cercando per Nome + Cognome (+ Taglia precedente se fornita)
 * Se la riga non viene trovata, effettua un append come fallback per non perdere i dati.
 */
export async function updateTshirtInGoogleSheet(params: {
  oldFirstName: string;
  oldLastName: string;
  oldSize?: string;
  newFirstName?: string;
  newLastName?: string;
  newSize?: string;
  newType?: string;
}): Promise<void> {
  const { spreadsheetId } = config.googleSheets;
  if (!spreadsheetId) {
    throw new Error('GOOGLE_SHEET_ID non configurato');
  }

  const sheets = getGoogleSheetsClient();
  const range = 'Magliette!A2:D';

  // Valori nuovi (se non forniti, usa vecchi)
  const nextFirstName = capitalizeWords((params.newFirstName ?? params.oldFirstName).trim());
  const nextLastName = capitalizeWords((params.newLastName ?? params.oldLastName).trim());
  const nextSize = (params.newSize ?? params.oldSize ?? '').trim().toUpperCase();
  const nextType = (params.newType ?? '').trim();

  try {
    // Leggi tutte le righe per trovare l'indice
    const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    const rows = res.data.values || [];

    let rowIndex: number | null = null; // indice relativo all'inizio del range (0 = riga 2 nel foglio)
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] || [];
      const f = (row[0] || '').toString().trim();
      const l = (row[1] || '').toString().trim();
      const s = (row[2] || '').toString().trim().toUpperCase();
      if (
        f.localeCompare(params.oldFirstName, undefined, { sensitivity: 'accent' }) === 0 &&
        l.localeCompare(params.oldLastName, undefined, { sensitivity: 'accent' }) === 0 &&
        (!params.oldSize || s === params.oldSize.toUpperCase())
      ) {
        rowIndex = i; // trovato
        break;
      }
    }

    if (rowIndex === null) {
      // Fallback: append nuova riga
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'Magliette!A:D',
        valueInputOption: 'RAW',
        insertDataOption: 'OVERWRITE',
        requestBody: { values: [[nextFirstName, nextLastName, nextSize, nextType]] },
      });
      logger.warn(`Riga Magliette non trovata per ${params.oldLastName} ${params.oldFirstName}. Eseguito append.`);
      return;
    }

    // Calcola riga assoluta nel foglio (somma offset 2 perché il range parte da A2)
    const absoluteRow = rowIndex + 2;
    const updateRange = `Magliette!A${absoluteRow}:D${absoluteRow}`;

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: updateRange,
      valueInputOption: 'RAW',
      requestBody: { values: [[nextFirstName, nextLastName, nextSize, nextType]] },
    });

    logger.info(`Aggiornata riga Magliette ${absoluteRow}: ${nextLastName} ${nextFirstName} | ${nextSize} | ${nextType}`);
  } catch (error: any) {
    logger.error('Errore aggiornamento Google Sheet MAGLIETTE:', error.message);
    throw new Error(`Impossibile aggiornare Google Sheet MAGLIETTE: ${error.message}`);
  }
}

/**
 * NAVETTE - Struttura Google Sheets per navette
 *
 * Layout:
 * - Riga 1 (da colonna B): Orari (22:30, 22:40, 22:50, ...)
 * - Colonna A, ogni 4 righe: Nome macchina (MACCHINA 1, MACCHINA 2, MACCHINA 3)
 * - Righe 2-5: MACCHINA 1 (4 posti per ogni slot orario)
 * - Righe 6-9: MACCHINA 2 (4 posti per ogni slot orario)
 * - Righe 10-13: MACCHINA 3 (4 posti per ogni slot orario)
 *
 * Esempio:
 *      A            B        C        D
 * 1                22:30    22:40    22:50
 * 2   MACCHINA 1  Mario    Luca     Anna
 * 3                Paolo    Sara
 * 4
 * 5
 * 6   MACCHINA 2  Carlo
 * 7
 * 8
 * 9
 */

export interface ParsedShuttleAssignment {
  machineName: string; // "MACCHINA 1", "MACCHINA 2", etc.
  slotTime: string; // "22:30", "22:40", etc.
  fullName: string; // Nome completo della persona
  direction: 'ANDATA' | 'RITORNO';
  cellPosition: { row: number; col: string }; // Posizione cella per update
}

/**
 * Legge il foglio navette (Andata o Ritorno)
 * @param direction "ANDATA" o "RITORNO"
 * @returns Array di assegnazioni parsate
 */
export async function readShuttlesSheet(direction: 'ANDATA' | 'RITORNO'): Promise<ParsedShuttleAssignment[]> {
  const { spreadsheetId } = config.googleSheets;

  if (!spreadsheetId) {
    throw new Error('GOOGLE_SHEET_ID non configurato');
  }

  const sheetName = direction === 'ANDATA'
    ? (config.googleSheets as any).shuttlesOutboundSheetName || 'Navette Andata'
    : (config.googleSheets as any).shuttlesReturnSheetName || 'Navette Ritorno';
  const range = `${sheetName}!A1:ZZ20`; // Leggi tutto, max 20 righe e tutte le colonne

  logger.info(`Lettura Google Sheet NAVETTE ${direction}: ${spreadsheetId}, range: ${range}`);

  const sheets = getGoogleSheetsClient();

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const rows = response.data.values;

    if (!rows || rows.length === 0) {
      logger.warn(`Google Sheet NAVETTE ${direction} vuoto`);
      return [];
    }

    const assignments: ParsedShuttleAssignment[] = [];

    // Riga 1 contiene gli orari (da colonna B = indice 1)
    const timeRow = rows[0] || [];
    const times: string[] = [];
    for (let colIdx = 1; colIdx < timeRow.length; colIdx++) {
      const time = timeRow[colIdx]?.toString().trim();
      if (time) {
        times.push(time);
      }
    }

    if (times.length === 0) {
      logger.warn(`Nessun orario trovato nella riga 1 del foglio ${sheetName}`);
      return [];
    }

    logger.info(`Orari trovati: ${times.join(', ')}`);

    // Analizza le macchine (ogni 4 righe)
    // Macchina 1: righe 2-5 (indici 1-4)
    // Macchina 2: righe 6-9 (indici 5-8)
    // Macchina 3: righe 10-13 (indici 9-12)

    const machineGroups = [
      { name: 'MACCHINA 1', startRow: 1, endRow: 4 }, // righe 2-5 nel foglio
      { name: 'MACCHINA 2', startRow: 5, endRow: 8 }, // righe 6-9
      { name: 'MACCHINA 3', startRow: 9, endRow: 12 }, // righe 10-13
    ];

    for (const machine of machineGroups) {
      // Verifica nome macchina in colonna A
      const machineNameCell = rows[machine.startRow]?.[0]?.toString().trim();
      const machineName = machineNameCell || machine.name; // fallback al nome di default

      logger.info(`Analizzando ${machineName} (righe ${machine.startRow + 1}-${machine.endRow + 1})`);

      // Per ogni slot orario (colonna)
      for (let timeIdx = 0; timeIdx < times.length; timeIdx++) {
        const colIdx = timeIdx + 1; // +1 perché colonna B = indice 1
        const slotTime = times[timeIdx];
        const colLetter = String.fromCharCode(66 + timeIdx); // B=66, C=67, etc.

        // Per ogni posto nella macchina (4 righe)
        for (let seatOffset = 0; seatOffset < 4; seatOffset++) {
          const rowIdx = machine.startRow + seatOffset;
          const absoluteRow = rowIdx + 1; // +1 perché array parte da 0, foglio da 1

          if (rowIdx >= rows.length) continue;

          const cell = rows[rowIdx]?.[colIdx];
          const fullName = cell?.toString().trim();

          if (fullName) {
            assignments.push({
              machineName,
              slotTime,
              fullName,
              direction,
              cellPosition: {
                row: absoluteRow,
                col: colLetter,
              },
            });
          }
        }
      }
    }

    logger.info(`Parsate ${assignments.length} assegnazioni navette ${direction} da Google Sheet`);
    return assignments;

  } catch (error: any) {
    logger.error(`Errore lettura Google Sheet NAVETTE ${direction}:`, error.message);
    throw new Error(`Impossibile leggere Google Sheet NAVETTE ${direction}: ${error.message}`);
  }
}

/**
 * Scrive o aggiorna una cella nel foglio navette
 * @param direction "ANDATA" o "RITORNO"
 * @param cellPosition Posizione cella (es. { row: 2, col: "B" })
 * @param fullName Nome completo da scrivere (vuoto per cancellare)
 */
export async function updateShuttleCellInGoogleSheet(
  direction: 'ANDATA' | 'RITORNO',
  cellPosition: { row: number; col: string },
  fullName: string
): Promise<void> {
  const { spreadsheetId } = config.googleSheets;

  if (!spreadsheetId) {
    throw new Error('GOOGLE_SHEET_ID non configurato');
  }

  const sheetName = direction === 'ANDATA'
    ? (config.googleSheets as any).shuttlesOutboundSheetName || 'Navette Andata'
    : (config.googleSheets as any).shuttlesReturnSheetName || 'Navette Ritorno';
  const cellRange = `${sheetName}!${cellPosition.col}${cellPosition.row}`;

  const formattedName = fullName.trim() ? capitalizeWords(fullName.trim()) : '';

  const sheets = getGoogleSheetsClient();

  try {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: cellRange,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[formattedName]],
      },
    });

    logger.info(`Aggiornata cella navette ${direction} ${cellRange}: "${formattedName}"`);
  } catch (error: any) {
    logger.error(`Errore aggiornamento cella navette ${direction}:`, error.message);
    throw new Error(`Impossibile aggiornare cella navette: ${error.message}`);
  }
}

/**
 * Legge gli orari dalla riga 1 del foglio navette
 * @param direction "ANDATA" o "RITORNO"
 * @returns Array di orari (es. ["22:30", "22:40", ...])
 */
export async function readShuttleTimesFromSheet(direction: 'ANDATA' | 'RITORNO'): Promise<string[]> {
  const { spreadsheetId } = config.googleSheets;

  if (!spreadsheetId) {
    throw new Error('GOOGLE_SHEET_ID non configurato');
  }

  const sheetName = direction === 'ANDATA'
    ? (config.googleSheets as any).shuttlesOutboundSheetName || 'Navette Andata'
    : (config.googleSheets as any).shuttlesReturnSheetName || 'Navette Ritorno';
  const range = `${sheetName}!B1:ZZ1`;

  const sheets = getGoogleSheetsClient();

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const timeRow = response.data.values?.[0] || [];
    const times: string[] = [];

    for (const time of timeRow) {
      const trimmed = time?.toString().trim();
      if (trimmed) {
        times.push(trimmed);
      }
    }

    return times;
  } catch (error: any) {
    logger.error(`Errore lettura orari navette ${direction}:`, error.message);
    throw new Error(`Impossibile leggere orari navette: ${error.message}`);
  }
}

/**
 * Elimina uno slot (colonna orario) dal foglio navette
 * @param direction "ANDATA" o "RITORNO"
 * @param time Orario dello slot da eliminare (es. "22:30")
 */
export async function deleteShuttleSlotFromSheet(direction: 'ANDATA' | 'RITORNO', time: string): Promise<void> {
  const { spreadsheetId } = config.googleSheets;

  if (!spreadsheetId) {
    throw new Error('GOOGLE_SHEET_ID non configurato');
  }

  const sheetName = direction === 'ANDATA'
    ? (config.googleSheets as any).shuttlesOutboundSheetName || 'Navette Andata'
    : (config.googleSheets as any).shuttlesReturnSheetName || 'Navette Ritorno';
  const sheets = getGoogleSheetsClient();

  try {
    // 1. Ottieni i metadati del foglio per trovare lo sheetId
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const sheet = spreadsheet.data.sheets?.find(s => s.properties?.title === sheetName);

    if (!sheet || !sheet.properties?.sheetId) {
      throw new Error(`Foglio ${sheetName} non trovato`);
    }

    const sheetId = sheet.properties.sheetId;

    // 2. Leggi la riga 1 per trovare l'indice della colonna con quell'orario
    const range = `${sheetName}!B1:ZZ1`;
    const response = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    const timeRow = response.data.values?.[0] || [];

    let columnIndex = -1;
    for (let i = 0; i < timeRow.length; i++) {
      if (timeRow[i]?.toString().trim() === time.trim()) {
        columnIndex = i + 1; // +1 perché colonna B = indice 1 (0=A, 1=B, 2=C, ...)
        break;
      }
    }

    if (columnIndex === -1) {
      throw new Error(`Orario ${time} non trovato nel foglio ${sheetName}`);
    }

    // 3. Elimina la colonna usando batchUpdate
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId,
                dimension: 'COLUMNS',
                startIndex: columnIndex,
                endIndex: columnIndex + 1, // endIndex è esclusivo
              },
            },
          },
        ],
      },
    });

    logger.info(`Eliminata colonna ${columnIndex} (orario ${time}) dal foglio ${sheetName}`);
  } catch (error: any) {
    logger.error(`Errore eliminazione slot da Google Sheet ${direction}:`, error.message);
    throw new Error(`Impossibile eliminare slot da Google Sheet: ${error.message}`);
  }
}
