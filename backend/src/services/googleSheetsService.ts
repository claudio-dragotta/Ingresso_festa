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
  range: string; // es: "Lista!A2:B" (legge dalla riga 2 in poi, colonne A e B)
  credentials: string; // JSON Service Account
}

export interface ParsedPerson {
  firstName: string;
  lastName: string;
  paymentType?: string; // Tipologia pagamento dalla colonna B
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
 * Legge i dati dalle colonne A e B del foglio Google
 * @returns Array di righe: [nome, tipologia pagamento]
 */
export async function readGoogleSheetColumns(): Promise<Array<{colA: string, colB?: string}>> {
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

    // Estrai colonna A (nome) e colonna B (tipologia pagamento)
    const data = rows
      .filter(row => row[0]?.toString().trim()) // Solo righe con colonna A non vuota
      .map(row => ({
        colA: row[0]?.toString().trim(),
        colB: row[1]?.toString().trim().toLowerCase() || undefined, // Tipologia pagamento (opzionale)
      }));

    logger.info(`Letti ${data.length} valori dal Google Sheet`);
    return data;

  } catch (error: any) {
    logger.error('Errore lettura Google Sheet:', error.message);
    throw new Error(`Impossibile leggere Google Sheet: ${error.message}`);
  }
}

/**
 * Parser per formato "Cognome Nome" + tipologia pagamento
 *
 * Esempi:
 * - "Rossi Mario" + "paypal" -> { lastName: "Rossi", firstName: "Mario", paymentType: "paypal" }
 * - "Rizzo Simone" + "contanti" -> { lastName: "Rizzo", firstName: "Simone", paymentType: "contanti" }
 * - "De Luca Anna" + "bonifico" -> { lastName: "De Luca", firstName: "Anna", paymentType: "bonifico" }
 * - "Van Der Berg Jan" + "p2p" -> { lastName: "Van Der Berg", firstName: "Jan", paymentType: "p2p" }
 *
 * Strategia:
 * - Splitta per spazi
 * - L'ultima parola è il nome (firstName)
 * - Tutto il resto è il cognome (lastName)
 * - Aggiungi tipologia pagamento se presente
 */
export function parsePersonName(fullName: string, paymentType?: string): ParsedPerson {
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
      paymentType,
      originalValue: fullName,
    };
  }

  // L'ultima parola è il nome, il resto è il cognome
  const firstName = parts.pop()!; // Ultima parola
  const lastName = parts.join(' '); // Tutto il resto unito

  return {
    firstName,
    lastName,
    paymentType,
    originalValue: fullName,
  };
}

/**
 * Legge e parsa tutte le persone dal Google Sheet
 * @returns Array di persone parsate con tipologia pagamento
 */
export async function fetchAndParseGoogleSheet(): Promise<ParsedPerson[]> {
  const rawData = await readGoogleSheetColumns();

  const parsedPersons: ParsedPerson[] = [];
  const errors: string[] = [];

  for (const row of rawData) {
    try {
      const person = parsePersonName(row.colA, row.colB);

      // Validazione: almeno cognome deve essere presente
      if (!person.lastName) {
        errors.push(`Ignorato: "${row.colA}" (cognome mancante)`);
        continue;
      }

      parsedPersons.push(person);
    } catch (error: any) {
      errors.push(`Errore parsing "${row.colA}": ${error.message}`);
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
    await readGoogleSheetColumns();
    logger.info('Connessione Google Sheets OK');
    return true;
  } catch (error: any) {
    logger.error('Test connessione Google Sheets fallito:', error.message);
    return false;
  }
}

/**
 * Scrive una nuova riga nel Google Sheet (per sincronizzazione bidirezionale)
 * @param fullName Nome completo formato "Cognome Nome"
 * @param paymentType Tipologia pagamento
 */
export async function writeToGoogleSheet(fullName: string, paymentType?: string): Promise<void> {
  const { spreadsheetId } = config.googleSheets;

  if (!spreadsheetId) {
    throw new Error('GOOGLE_SHEET_ID non configurato');
  }

  const sheets = getGoogleSheetsClient();

  try {
    // Aggiungi nuova riga alla fine
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Lista!A:B', // Scrivi su colonne A e B
      valueInputOption: 'RAW',
      requestBody: {
        values: [[fullName, paymentType || '']], // [Cognome Nome, tipologia pagamento]
      },
    });

    logger.info(`Scritto su Google Sheet: ${fullName} | ${paymentType || 'N/D'}`);
  } catch (error: any) {
    logger.error('Errore scrittura Google Sheet:', error.message);
    throw new Error(`Impossibile scrivere su Google Sheet: ${error.message}`);
  }
}
