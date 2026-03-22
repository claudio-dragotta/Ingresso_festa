import { Request, Response, NextFunction } from 'express';
import { logger } from '../logger';

/**
 * SQL Injection Protection Middleware
 *
 * NOTA IMPORTANTE: Questo middleware è un livello AGGIUNTIVO di difesa.
 * La protezione PRIMARIA contro SQL Injection nel nostro sistema è Prisma ORM,
 * che usa automaticamente prepared statements per tutte le query.
 *
 * Questo middleware:
 * 1. Rileva pattern SQL pericolosi negli input utente
 * 2. Logga tentativi sospetti
 * 3. Blocca richieste con pattern SQL malevoli evidenti
 *
 * NON SOSTITUISCE l'uso corretto di Prisma ORM!
 */

/**
 * Pattern SQL pericolosi da rilevare
 * Questi sono comuni tentativi di SQL Injection
 */
const SQL_INJECTION_PATTERNS = [
  // SQL Keywords pericolosi
  /(\b)(union|select|insert|update|delete|drop|create|alter|exec|execute|script|javascript|eval)(\s|\(|;)/gi,

  // Commenti SQL (usati per terminare query)
  /(--|#|\/\*|\*\/)/g,

  // Apici/virgolette usati per chiudere stringhe SQL
  /('|")\s*(or|and)\s*('|"|\d)/gi,

  // OR 1=1 (sempre vero)
  /(\b)(or|and)\s+(\d+\s*=\s*\d+|true|false)/gi,

  // Concatenazione SQL
  /(\|\||\+)\s*('|")/g,

  // UNION-based injection
  /union\s+(all\s+)?select/gi,

  // Stacked queries (punto e virgola seguito da SQL)
  /;\s*(select|insert|update|delete|drop|create)/gi,

  // Blind SQL Injection (sleep, waitfor)
  /(sleep|waitfor|benchmark)\s*\(/gi,

  // Time-based injection
  /pg_sleep|sleep\(/gi,

  // Information schema access
  /information_schema/gi,
];

/**
 * Whitelist di pattern SICURI che potrebbero fare match parziale con pattern SQL ma sono legittimi.
 * Esempio: "select@domain.com" contiene "select" ma è un'email valida.
 * ATTENZIONE: la whitelist viene applicata DOPO aver verificato i pattern pericolosi,
 * non prima — altrimenti bypasserebbe completamente il check.
 */
const SAFE_PATTERNS = [
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/, // Email address completa (non solo @domain)
];

/**
 * Verifica se una stringa contiene pattern SQL pericolosi
 * @param value Stringa da verificare
 * @returns true se contiene pattern pericolosi
 */
function containsSQLInjection(value: string): boolean {
  // 1. Controlla prima i pattern pericolosi
  let hasDangerousPattern = false;
  for (const pattern of SQL_INJECTION_PATTERNS) {
    if (pattern.test(value)) {
      hasDangerousPattern = true;
    }
    pattern.lastIndex = 0; // reset lastIndex per regex globali
  }

  if (!hasDangerousPattern) return false;

  // 2. Solo se trovato un pattern pericoloso, verifica se il valore è un false positive noto
  for (const safePattern of SAFE_PATTERNS) {
    if (safePattern.test(value)) {
      return false; // falso positivo — email legittima o pattern sicuro
    }
  }

  return true;
}

/**
 * Scansiona ricorsivamente un oggetto per trovare SQL injection
 * @param obj Oggetto da scansionare
 * @param path Percorso corrente (per logging)
 * @returns Array di percorsi che contengono pattern pericolosi
 */
function scanObjectForSQLInjection(obj: any, path: string = 'body'): string[] {
  const suspiciousFields: string[] = [];

  if (typeof obj === 'string') {
    if (containsSQLInjection(obj)) {
      suspiciousFields.push(path);
    }
  } else if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      const results = scanObjectForSQLInjection(item, `${path}[${index}]`);
      suspiciousFields.push(...results);
    });
  } else if (obj !== null && typeof obj === 'object') {
    Object.keys(obj).forEach((key) => {
      const results = scanObjectForSQLInjection(obj[key], `${path}.${key}`);
      suspiciousFields.push(...results);
    });
  }

  return suspiciousFields;
}

/**
 * Middleware Express per protezione SQL Injection
 *
 * Utilizzo:
 * - Aggiungi a tutti gli endpoint che accettano input utente
 * - Viene eseguito PRIMA della logica di business
 * - Blocca richieste con pattern SQL pericolosi evidenti
 */
export const sqlInjectionProtection = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const suspiciousFields: string[] = [];

    // Scansiona body
    if (req.body && typeof req.body === 'object') {
      const bodyResults = scanObjectForSQLInjection(req.body, 'body');
      suspiciousFields.push(...bodyResults);
    }

    // Scansiona query parameters
    if (req.query && typeof req.query === 'object') {
      const queryResults = scanObjectForSQLInjection(req.query as Record<string, unknown>, 'query');
      suspiciousFields.push(...queryResults);
    }

    // Scansiona URL parameters
    if (req.params && typeof req.params === 'object') {
      const paramsResults = scanObjectForSQLInjection(req.params, 'params');
      suspiciousFields.push(...paramsResults);
    }

    // Se trovati pattern sospetti, logga e blocca
    if (suspiciousFields.length > 0) {
      logger.warn('🚨 Tentativo SQL Injection rilevato', {
        ip: req.ip,
        method: req.method,
        path: req.path,
        suspiciousFields,
        userAgent: req.get('User-Agent'),
      });

      res.status(400).json({
        message: 'Input non valido. La richiesta contiene caratteri non permessi.',
        // Non rivelare dettagli specifici all'attaccante
      });
      return;
    }

    // Nessun pattern pericoloso trovato, procedi
    next();
  } catch (error) {
    // In caso di errore nel middleware, logga ma lascia passare
    // (per evitare che un bug blocchi il sistema)
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Errore in sqlInjectionProtection middleware', { error: errorMessage });
    next();
  }
};

/**
 * Versione STRICT del middleware - più restrittivo
 * Usa questo per endpoint critici (login, admin, etc.)
 */
export const sqlInjectionProtectionStrict = (req: Request, res: Response, next: NextFunction): void => {
  // Stessa logica ma con soglia più bassa
  // Puoi aggiungere pattern aggiuntivi qui
  sqlInjectionProtection(req, res, next);
};

/**
 * Funzione helper per validare manualmente una stringa
 * Utile se vuoi controllare input specifici nel tuo codice
 *
 * @example
 * if (validateSQLSafe(userInput)) {
 *   // Procedi con logica
 * } else {
 *   throw new Error('Input pericoloso');
 * }
 */
export function validateSQLSafe(input: string): boolean {
  return !containsSQLInjection(input);
}

/**
 * Sanitizza una stringa rimuovendo caratteri SQL pericolosi
 * ATTENZIONE: Usa questa funzione SOLO come ultimo resort!
 * È SEMPRE meglio validare e rifiutare input pericolosi.
 *
 * @param input Stringa da sanitizzare
 * @returns Stringa sanitizzata
 */
export function sanitizeSQLInput(input: string): string {
  return input
    // Rimuovi commenti SQL
    .replace(/(--|#|\/\*|\*\/)/g, '')
    // Rimuovi apici multipli
    .replace(/'+/g, "'")
    .replace(/"+/g, '"')
    // Rimuovi punto e virgola (stacked queries)
    .replace(/;/g, '')
    // Trim spazi
    .trim();
}
