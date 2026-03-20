import path from "path";
import dotenv from "dotenv";

const envFile = process.env.NODE_ENV === "production" ? ".env" : ".env.local";
dotenv.config({
  path: [
    path.resolve(process.cwd(), envFile),
    path.resolve(process.cwd(), ".env"),
  ],
});

const required = (value: string | undefined, key: string): string => {
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

export const config = {
  env: process.env.NODE_ENV ?? "development",
  isProduction: process.env.NODE_ENV === "production",
  port: Number(process.env.PORT ?? 8000),
  host: process.env.HOST ?? "0.0.0.0",
  // Single or comma-separated list of allowed frontend origins for CORS.
  // Example: "https://ingressofesta.com,https://www.ingressofesta.com"
  frontendUrl: process.env.FRONTEND_URL,
  frontendOrigins: process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(",").map((s) => s.trim()).filter(Boolean)
    : undefined,
  databaseUrl: required(process.env.DATABASE_URL, "DATABASE_URL"),
  jwtSecret: required(process.env.JWT_SECRET, "JWT_SECRET"),
  disableEnvAdminFallback: process.env.DISABLE_ENV_ADMIN_FALLBACK === "true",
  // Se il fallback ENV admin è disabilitato, non richiedere queste variabili
  adminUsername: process.env.DISABLE_ENV_ADMIN_FALLBACK === "true"
    ? undefined
    : required(process.env.ADMIN_USERNAME, "ADMIN_USERNAME"),
  adminPassword: process.env.DISABLE_ENV_ADMIN_FALLBACK === "true"
    ? undefined
    : required(process.env.ADMIN_PASSWORD, "ADMIN_PASSWORD"),
  qrOutputDir: process.env.QR_OUTPUT_DIR ?? path.resolve(process.cwd(), "../storage/qrcodes"),
  email: {
    from: process.env.EMAIL_FROM ?? "noreply@example.com",
    transportUrl: process.env.EMAIL_TRANSPORT_URL,
  },
  googleSheets: {
    spreadsheetId: process.env.GOOGLE_SHEET_ID ?? "",
    range: process.env.GOOGLE_SHEET_RANGE ?? "Lista!A2:B", // Colonna A (nome) + B (tipologia pagamento), dati da riga 2
    credentials: process.env.GOOGLE_SERVICE_ACCOUNT_JSON ?? "",
    autoSyncEnabled: process.env.GOOGLE_SHEETS_AUTO_SYNC === "true",
    autoSyncIntervalMinutes: Number(process.env.GOOGLE_SHEETS_SYNC_INTERVAL ?? 3),
    // Nomi dei tab per le navette (configurabili per adattarsi al foglio reale)
    shuttlesOutboundSheetName: process.env.GOOGLE_SHEET_SHUTTLES_OUTBOUND_NAME ?? "Navette Andata",
    shuttlesReturnSheetName: process.env.GOOGLE_SHEET_SHUTTLES_RETURN_NAME ?? "Navette Ritorno",
  },
  shuttle: {
    machineCapacity: Number(process.env.SHUTTLE_MACHINE_CAPACITY ?? 4),
    slotCapacity: Number(process.env.SHUTTLE_SLOT_CAPACITY ?? 12),
    stepMinutes: Number(process.env.SHUTTLE_STEP_MINUTES ?? 10),
    outbound: {
      from: process.env.SHUTTLE_OUTBOUND_FROM ?? "22:30",
      to: process.env.SHUTTLE_OUTBOUND_TO ?? "00:30",
    },
    return: {
      from: process.env.SHUTTLE_RETURN_FROM ?? "03:30",
      to: process.env.SHUTTLE_RETURN_TO ?? "05:20",
    },
    defaultMachines: (process.env.SHUTTLE_MACHINES ?? "MACCHINA 1,MACCHINA 2,MACCHINA 3").split(",").map((s) => s.trim()).filter(Boolean),
  },
  // Opzionale: elenco utenti definiti via ENV in JSON
  // Formato accettato: array oppure { users: [...] }
  // Ogni utente: { username: string, password: string(bcrypt o plain), role: 'ADMIN'|'ENTRANCE'|'ORGANIZER'|'SHUTTLE', active?: boolean }
  envUsers: (() => {
    const raw = process.env.USERS_JSON || process.env.AUTH_USERS_JSON;
    if (!raw) return undefined;
    try {
      const parsed = JSON.parse(raw);
      const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.users) ? parsed.users : [];
      const allowedRoles = new Set(["ADMIN", "ENTRANCE", "ORGANIZER", "SHUTTLE"]);
      return (list as Array<any>)
        .filter((u) => u && typeof u.username === 'string' && typeof u.password === 'string')
        .map((u) => ({
          username: String(u.username),
          password: String(u.password),
          role: allowedRoles.has(u.role) ? (u.role as any) : 'ENTRANCE',
          active: typeof u.active === 'boolean' ? u.active : true,
        }));
    } catch {
      // Se JSON non valido, ignora
      return undefined;
    }
  })(),
};

export const eventDomain = process.env.EVENT_DOMAIN ?? "https://example.com";
