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
