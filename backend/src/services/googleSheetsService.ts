import { google } from 'googleapis';
import { logger } from '../logger';
import { config } from '../config';

/**
 * Google Sheets Service
 *
 * Gestisce la lettura automatica dal foglio Google configurato.
 * Formato atteso: Colonna A con "Cognome Nome" (es: "Rossi Mario")
 */

interface GoogleSheetsConfig {
  spreadsheetId: string;
  range: string; // es: "Lista!A2:A" (legge dalla riga 2 in poi)
  credentials: string; // JSON Service Account
}

export interface ParsedPerson {
  firstName: string;
  lastName: string;
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
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  return google.sheets({ version: 'v4', auth });
}

/**
 * Legge i dati dalla colonna A del foglio Google
 * @returns Array di valori dalla colonna A (rimuove celle vuote)
 */
export async function readGoogleSheetColumn(): Promise<string[]> {
  const { spreadsheetId, range } = config.googleSheets;

  if (!spreadsheetId) {
    throw new Error('GOOGLE_SHEET_ID non configurato');
  }

  logger.info(`Lettura Google Sheet: ${spreadsheetId}, range: ${range}`);

  const sheets = getGoogleSheetsClient();

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const rows = response.data.values;

    if (!rows || rows.length === 0) {
      logger.warn('Google Sheet vuoto o nessun dato nel range specificato');
      return [];
    }

    // Estrai solo la prima colonna e rimuovi celle vuote
    const columnAValues = rows
      .map(row => row[0]?.toString().trim())
      .filter(value => value && value.length > 0);

    logger.info(`Letti ${columnAValues.length} valori dalla colonna A`);
    return columnAValues;

  } catch (error: any) {
    logger.error('Errore lettura Google Sheet:', error.message);
    throw new Error(`Impossibile leggere Google Sheet: ${error.message}`);
  }
}

/**
 * Parser per formato "Cognome Nome" -> { firstName, lastName }
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
export function parsePersonName(fullName: string): ParsedPerson {
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
      originalValue: fullName,
    };
  }

  // L'ultima parola è il nome, il resto è il cognome
  const firstName = parts.pop()!; // Ultima parola
  const lastName = parts.join(' '); // Tutto il resto unito

  return {
    firstName,
    lastName,
    originalValue: fullName,
  };
}

/**
 * Legge e parsa tutte le persone dal Google Sheet
 * @returns Array di persone parsate
 */
export async function fetchAndParseGoogleSheet(): Promise<ParsedPerson[]> {
  const rawValues = await readGoogleSheetColumn();

  const parsedPersons: ParsedPerson[] = [];
  const errors: string[] = [];

  for (const value of rawValues) {
    try {
      const person = parsePersonName(value);

      // Validazione: almeno cognome deve essere presente
      if (!person.lastName) {
        errors.push(`Ignorato: "${value}" (cognome mancante)`);
        continue;
      }

      parsedPersons.push(person);
    } catch (error: any) {
      errors.push(`Errore parsing "${value}": ${error.message}`);
    }
  }

  if (errors.length > 0) {
    logger.warn(`Errori parsing Google Sheet (${errors.length}): ${errors.join(', ')}`);
  }

  logger.info(`Parsate ${parsedPersons.length} persone valide da Google Sheet`);
  return parsedPersons;
}

/**
 * Verifica connessione a Google Sheets (test)
 */
export async function testGoogleSheetsConnection(): Promise<boolean> {
  try {
    await readGoogleSheetColumn();
    logger.info('Connessione Google Sheets OK');
    return true;
  } catch (error: any) {
    logger.error('Test connessione Google Sheets fallito:', error.message);
    return false;
  }
}
