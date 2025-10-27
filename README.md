# Ingresso Festa – Sistema di accesso con QR code

Applicazione full-stack per gestire l'ingresso a eventi privati tramite QR code univoci, con dashboard di controllo, pagina di scansione dedicata e importazione massiva degli invitati.

## Funzionalità principali
- Generazione di QR code firmati e non duplicabili per ogni invitato (PNG nominati `Nome-Cognome`).
- Verifica in tempo reale via API: ingresso consentito, già utilizzato, codice non valido, evento in pausa o bloccato.
- **Sincronizzazione automatica con Google Sheets**: importa automaticamente nuove persone dal tuo foglio Google (formato "Cognome Nome" nella colonna A) con controllo duplicati e generazione QR automatica.
- Dashboard operativa con:
  - statistiche live (totale, entrati, in arrivo, annullati);
  - elenco invitati con filtri, riepiloghi e azioni (reset, invio email, download QR);
  - pianificazione stato evento (attivo/pausa/bloccato);
  - importazione manuale, da testo, o da file Excel/CSV (Nome, Cognome, Email, Telefono);
  - **bottone sincronizzazione Google Sheets** per import immediato.
- Pagina di scansione protetta (accesso solo dopo login) che utilizza la fotocamera del dispositivo ed esegue la convalida lato server.
- Supporto a distribuzione dei QR via email tramite SMTP configurabile.

## Architettura
- **Backend** (`backend/`): Node.js + Express + Prisma (SQLite in locale e su Render tramite disco persistente). Genera QR, gestisce check-in, invia email.
- **Frontend** (`frontend/`): React + Vite + React Query. Fornisce dashboard e scanner.
- **Storage locale** (`storage/`): contiene immagini dei QR e database SQLite di sviluppo (ignorati da Git).

## Requisiti
- Node.js >= 20
- npm >= 10
- (Dev) SQLite incorporato via Prisma
- (Prod) SQLite su disco persistente (Render Disk)

## Setup locale
1. Clona il repository e installa le dipendenze:
   ```bash
   cd backend
   npm install
   npm run prisma:generate
   # imposta la variabile DATABASE_URL, es. "file:../storage/data/dev.db"
   npm run prisma:migrate -- --name init   # genera il database di sviluppo
   cd ../frontend
   npm install
   ```
2. Configura gli environment:
   - copia `backend/.env.example` in `backend/.env` e personalizza i valori (vedi tabella sotto);
   - copia `frontend/.env.example` in `frontend/.env` e imposta `VITE_API_BASE_URL` (es. `http://localhost:8000/api`).
3. Avvia i servizi in due terminali:
   ```bash
   # Terminale 1
   cd backend
   npm run dev

   # Terminale 2
   cd frontend
   npm run dev
   ```
   La dashboard sarà disponibile su `http://localhost:5173`, il backend su `http://localhost:8000`.

### Ambiente backend
| Variabile | Descrizione |
|-----------|-------------|
| `NODE_ENV` | `development` o `production` |
| `HOST` / `PORT` | Binding del server (default `0.0.0.0:8000`) |
| `DATABASE_URL` | Connessione Prisma (es. `file:../storage/data/dev.db` in locale, `file:/var/data/ingresso.db` su Render) |
| `JWT_SECRET` | Secret per firmare i token di sessione |
| `ADMIN_USERNAME` | Username login amministratore |
| `ADMIN_PASSWORD` | Password (plain solo in dev). Usa `npm run hash-password -- <password>` per generare un hash bcrypt da usare in produzione |
| `FRONTEND_URL` | Origine consentita per le richieste (es. `http://localhost:5173`) |
| `QR_OUTPUT_DIR` | Cartella per salvare i QR (`../storage/qrcodes` di default) |
| `EMAIL_FROM` | Mittente email QR |
| `EMAIL_TRANSPORT_URL` | URL SMTP compatibile Nodemailer (es. `smtp://user:pass@smtp.mailgun.org:587`) |
| `EVENT_DOMAIN` | Dominio pubblico dell'evento (opzionale, per link e comunicazioni) |
| `GOOGLE_SHEET_ID` | ID del foglio Google Sheets (dalla URL: `https://docs.google.com/spreadsheets/d/{ID}/edit`) |
| `GOOGLE_SHEET_RANGE` | Range da leggere (default: `Lista!A2:A`) |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Credenziali Service Account Google Cloud (JSON completo su una riga) |
| `GOOGLE_SHEETS_AUTO_SYNC` | Abilita sincronizzazione automatica (`true`/`false`) |
| `GOOGLE_SHEETS_SYNC_INTERVAL` | Intervallo sincronizzazione in minuti (default: `10`) |

> Per la configurazione completa di Google Sheets, consulta la guida dettagliata in [GOOGLE_SHEETS_SETUP.md](GOOGLE_SHEETS_SETUP.md).

> 💡 Su Windows Prisma 6 richiede una `DATABASE_URL` in formato URI **assoluto** (`file:C:/Percorso/Ingresso_festa/storage/data/dev.db`). Se ottieni l'errore generico “Schema engine error”, riscrivi il percorso in questo modo oppure esporta temporaneamente la variabile prima di lanciare i comandi `prisma migrate`.

### Script utili backend
- `npm run dev`: avvio con ts-node e nodemon.
- `npm run build` / `npm start`: build TypeScript → `dist/` e avvio della versione compilata.
- `npm run prisma:migrate`: applica migrazioni in sviluppo (`DATABASE_URL` deve puntare al file SQLite corretto).
- `npm run prisma:deploy`: applica migrazioni in produzione.
- `npm run hash-password -- <password>`: stampa un hash bcrypt da copiare in `ADMIN_PASSWORD` (consigliato per Render).

## Deploy su Render
### Struttura del file `render.yaml`
È incluso un `render.yaml` di esempio che definisce:
- un servizio **Web Service** Node per il backend (`npm install`, `npm run build`, `npx prisma migrate deploy`, `node dist/server.js`) con disco persistente montato su `/var/data` (contiene DB SQLite e QR generati);
- un servizio **Static Site** per il frontend (`npm install`, `npm run build`, publish `frontend/dist`).

### Passaggi consigliati
1. **Backend Web Service**:
   - Build Command: `cd backend && npm install && npx prisma generate && npm run build`
   - Start Command: `cd backend && npx prisma migrate deploy && node dist/server.js`
   - Configura le env var dal pannello Render (vedi tabella sopra). `DATABASE_URL` è già impostata a `file:/var/data/ingresso.db`.
   - Il disco `ingresso-festa-storage` (1 GB) mantiene database e QR tra i deploy.
2. **Frontend Static Site**:
   - Build Command: `cd frontend && npm install && npm run build`
   - Publish Directory: `frontend/dist`
   - Imposta l'env `VITE_API_BASE_URL` al dominio pubblico del backend (es. `https://ingresso-api.onrender.com/api`).
3. **Email**: se desideri l'invio automatico dei QR, fornisci un `EMAIL_TRANSPORT_URL` valido (SMTP, SendGrid, Mailgun…).
4. **Testing**: prima dell'evento, genera un set di invitati, verifica l'invio dei QR, prova la scansione e monitora la dashboard.

## Sicurezza
- I token nei QR hanno firma HMAC e vengono invalidati al primo utilizzo.
- La pagina di scansione richiede login (nessun check-in senza sessione valida).
- I QR funzionano solo tramite questa web app: scanner esterni vedranno solo il payload cifrato.
- Imposta password hashate e usa HTTPS in produzione.

## Struttura repository
```
backend/      API Express + Prisma, servizi QR/email
frontend/     Dashboard React + pagina Scanner
storage/      Cartelle per QR e database locali (ignorate da Git)
render.yaml   Configurazione opzionale per Render
README.md     Questo file
```

## Note finali
- In sviluppo e produzione viene usato SQLite; su Render il file risiede nel disco persistente montato (`/var/data/ingresso.db`).
- I QR vengono salvati su disco; su Render valuta l'uso di uno storage esterno (AWS S3, Render Disk) se vuoi conservarli nel tempo.
- Per reset massivo degli ingressi puoi usare l'endpoint `PATCH /api/invitees/:id/reset` dalla dashboard (azione per singolo invitato).

Buon evento! 🎉
