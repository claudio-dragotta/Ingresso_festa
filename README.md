# Ingresso Festa — Sistema di Gestione Ingressi Multi-Evento

Sistema completo per la gestione di ingressi, invitati, navette, magliette, spese e pre-registrazioni. Supporta **più feste contemporaneamente**, ognuna con dati, Google Sheet e ruoli utente separati.

- **Backend:** <https://ingresso-festa-api.onrender.com>
- **Frontend:** <https://ingresso-festa-web.onrender.com>
- **Registrazione pubblica:** <https://sesa-register.onrender.com>

![Node](https://img.shields.io/badge/node-%3E%3D20-green)
![TypeScript](https://img.shields.io/badge/typescript-5.6-blue)
![React](https://img.shields.io/badge/react-19-blue)

---

## Caratteristiche Principali

### Per gli Addetti all'Ingresso (ruolo ENTRANCE)

- Ricerca istantanea per nome o cognome con debounce
- Check-in con un tap: bottone verde/rosso
- Contatori live: quante persone devono ancora entrare (Paganti / Green / Totale)
- Accesso limitato alla sola pagina di ricerca

### Per gli Organizzatori (ruolo ORGANIZER)

- Dashboard completa con tab Paganti / Green
- Aggiunta e cancellazione invitati (scritto anche su Google Sheet)
- Analisi duplicati tra le due liste
- Invio QR via email a tutti gli invitati (bulk)
- Gestione pre-registrazioni (approva / rifiuta richieste)
- Accesso ai moduli attivi per la propria festa

### Per gli Admin (ruolo ADMIN)

- Accesso globale a tutte le feste
- Creazione e configurazione feste (moduli, Google Sheet ID, stato)
- Gestione utenti e assegnazione ruoli per evento
- Reset + Reimport completo da Google Sheets
- Tutte le funzionalità ORGANIZER

### Per gli Addetti Navette (ruolo SHUTTLE)

- Visualizzazione slot navetta (Andata / Ritorno)
- Marcatura saliti / non saliti per passeggero

---

## Moduli per Evento

Ogni festa può avere attivi o disattivi i seguenti moduli:

| Modulo       | Descrizione                                             |
| ------------ | ------------------------------------------------------- |
| Magliette    | Gestione consegna magliette con taglia e tipo           |
| Navette      | Slot andata/ritorno con macchine e assegnazioni         |
| Spese        | Tracciamento spese per categoria e metodo di pagamento  |

I moduli disattivi non appaiono nel menu e i relativi tab del Google Sheet non vengono letti.

---

## Integrazione Google Sheets

Ogni festa ha il proprio Google Sheet collegato. La struttura dei tab rispecchia i moduli attivi.

### Tab "Lista" (Paganti)

| Riga | A: Cognome Nome                     | B: Tipologia Pagamento | C: Email         |
| ---- | ----------------------------------- | ---------------------- | ---------------- |
| 1    | *(libera — intestazione opzionale)* |                        |                  |
| 2+   | Rossi Mario                         | paypal                 | mario@esempio.it |

### Tab "GREEN" (Non Paganti)

| Riga | A: Cognome Nome  | B: Email         |
| ---- | ---------------- | ---------------- |
| 1    | *(libera)*       |                  |
| 2+   | Bianchi Anna     | anna@esempio.it  |

> **Importante:** la **riga 1 è sempre riservata** — il sync legge da riga 2 in poi, e quando aggiungi una persona via app viene scritta a partire dalla riga 2. Puoi mettere un'intestazione in riga 1 o lasciarla vuota.

### Tab opzionali (se modulo attivo)

- `Magliette` — Cognome Nome, Taglia, Tipo, Consegnata
- `Navette_Andata` — Cognome Nome, Orario, Macchina
- `Navette_Ritorno` — Cognome Nome, Orario, Macchina

### Sincronizzazione Automatica

- Il backend sincronizza **ogni 3 minuti** tutti gli eventi attivi
- All'avvio del server viene eseguita una sincronizzazione immediata
- Nessun pulsante manuale nella dashboard: il sync è completamente automatico
- Rimangono disponibili: **Analizza duplicati**, **Reset + Reimport**, **Invia QR a tutti**

### Configurare il Service Account

1. Vai su [sheets.google.com](https://sheets.google.com) e crea il foglio
2. Clicca **Condividi** e aggiungi come Editor:

   ```text
   ingresso-festa-sync@lista-festa-8-novembre.iam.gserviceaccount.com
   ```

3. Copia l'ID dal URL: `https://docs.google.com/spreadsheets/d/ID_QUI/edit`

---

## Ruoli Utente

| Ruolo     | Ambito                    | Permessi principali                                         |
| --------- | ------------------------- | ----------------------------------------------------------- |
| ADMIN     | Globale (tutte le feste)  | Tutto: crea feste, gestisce utenti, reset DB, sync          |
| ORGANIZER | Per evento (assegnato)    | Dashboard, aggiungi/elimina, pre-registrazioni, QR bulk     |
| ENTRANCE  | Per evento (assegnato)    | Solo ricerca e check-in (non può annullare ingresso)        |
| SHUTTLE   | Per evento (assegnato)    | Solo gestione navette                                       |

Gli utenti ENTRANCE e SHUTTLE vedono **solo** la loro sezione. I menu e le route admin sono invisibili (404) per chi non ha permesso.

---

## Pagine Frontend

| Pagina                | Percorso          | Ruolo minimo |
| --------------------- | ----------------- | ------------ |
| Login                 | `/login`          | —            |
| Selezione Festa       | `/`               | Tutti        |
| Ricerca & Check-in    | `/search`         | ENTRANCE     |
| Dashboard Admin       | `/admin`          | ORGANIZER    |
| Pre-registrazioni     | `/preregistrations` | ORGANIZER  |
| Magliette             | `/tshirts`        | ORGANIZER    |
| Navette               | `/shuttles`       | SHUTTLE      |
| Spese                 | `/expenses`       | ORGANIZER    |
| Utenti                | `/users`          | ADMIN        |
| Scanner QR            | `/scan`           | ENTRANCE     |
| Registrazione pubblica | `/register` (dominio separato) | — |

---

## Quick Start

### Prerequisiti

- Node.js >= 20
- npm
- Account Google Cloud con Service Account configurato

### Backend

```bash
cd backend
npm install
npm run prisma:generate
npm run prisma:deploy
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Credenziali di default (solo sviluppo)

- **Admin:** `admin` / `admin123`
- **Ingresso:** `ingresso1` / `ingresso123`

> Cambia queste password prima di andare in produzione.

---

## Variabili d'Ambiente

### Backend

| Variabile                    | Descrizione                              | Esempio                                    |
| ---------------------------- | ---------------------------------------- | ------------------------------------------ |
| `DATABASE_URL`               | Percorso SQLite                          | `file:/var/data/ingresso.db`               |
| `JWT_SECRET`                 | Segreto JWT                              | `super-secret-key-123`                     |
| `FRONTEND_URL`               | Origini CORS consentite (virgola)        | `https://ingresso-festa-web.onrender.com,https://sesa-register.onrender.com` |
| `PORT`                       | Porta server                             | `10000`                                    |
| `GOOGLE_SERVICE_ACCOUNT_JSON`| JSON service account (inline)            | `{"type":"service_account",...}`           |
| `GOOGLE_SHEET_RANGE`         | Range tab PAGANTI                        | `Lista!A2:B`                               |
| `GOOGLE_SHEET_GREEN_RANGE`   | Range tab GREEN                          | `GREEN!A2:A`                               |
| `GOOGLE_SHEETS_AUTO_SYNC`    | Abilita sync automatico                  | `true`                                     |
| `GOOGLE_SHEETS_SYNC_INTERVAL`| Minuti tra un sync e l'altro             | `3`                                        |
| `DISABLE_ENV_ADMIN_FALLBACK` | Disabilita admin da env (usa solo DB)    | `true`                                     |

### Frontend

| Variabile           | Descrizione        | Esempio                                               |
| ------------------- | ------------------ | ----------------------------------------------------- |
| `VITE_API_BASE_URL` | URL base backend   | `https://ingresso-festa-api.onrender.com/api`         |

---

## Deploy su Render

### Backend (Web Service)

- **Root Directory:** `Ingresso_festa/backend`
- **Build Command:** `npm ci && npm run build`
- **Start Command:** `npx prisma migrate deploy && node dist/server.js`
- **Persistent Disk:** montato su `/var/data` per SQLite
- **Secret Files:** aggiungi `users.json` (vedi `backend/users.example.json`)

### Frontend (Static Site)

- **Root Directory:** `Ingresso_festa/frontend`
- **Build Command:** `npm ci && npm run build`
- **Publish Directory:** `dist`
- **Env:** `VITE_API_BASE_URL`

---

## API Endpoints

Tutti gli endpoint per-evento seguono il pattern `/api/events/:eventId/...` e richiedono autenticazione JWT.

### Endpoint globali

```text
POST   /api/auth/login
GET    /api/auth/users           (ADMIN)
POST   /api/auth/users           (ADMIN)
PATCH  /api/auth/users/:id       (ADMIN)
DELETE /api/auth/users/:id       (ADMIN)
GET    /api/events
POST   /api/events               (ADMIN)
PATCH  /api/events/:id           (ADMIN)
GET    /api/users                (ADMIN)
POST   /api/register             (pubblico)
GET    /api/health
```

### Endpoint per-evento (`/api/events/:eventId/`)

```text
GET    invitees
POST   invitees
GET    invitees/stats
GET    invitees/duplicates
POST   invitees/:id/checkin
DELETE invitees/:id
POST   invitees/:id/send-qr
POST   sync/google-sheets
POST   sync/reset-and-reimport
GET    settings
PATCH  settings
POST   settings/setup-sheet
GET    tshirts
PATCH  tshirts/:id/received
GET    expenses
POST   expenses
DELETE expenses/:id
GET    shuttles/slots
POST   shuttles/slots
DELETE shuttles/slots/:id
GET    preregistrations
PATCH  preregistrations/:id
GET    dashboard
```

---

## Database — Schema Prisma

| Modello              | Descrizione                                                                 |
| -------------------- | --------------------------------------------------------------------------- |
| `Event`              | Festa con nome, data, Google Sheet ID, moduli attivi, stato                 |
| `UserEventAccess`    | Assegna un utente a una festa con un ruolo specifico                        |
| `User`               | Utente con username, password (bcrypt), ruolo globale, stato active         |
| `Invitee`            | Invitato con nome, lista (PAGANTE/GREEN), email, QR token, stato ingresso   |
| `CheckInLog`         | Log di ogni tentativo di check-in (SUCCESS/DUPLICATE/BLOCKED)               |
| `Tshirt`             | Maglietta assegnata a un invitato (taglia, tipo, consegnata)                |
| `Expense`            | Spesa con importo, categoria, metodo di pagamento                           |
| `ShuttleMachine`     | Veicolo navetta (nome, colore)                                              |
| `ShuttleSlot`        | Slot orario navetta (direzione, ora, capienza)                              |
| `ShuttleAssignment`  | Assegnazione invitato a slot+macchina con stato salita                      |
| `PreRegistration`    | Richiesta di pre-registrazione pubblica (PENDING/APPROVED/REJECTED)         |

### Enum `UserRole`

- `ADMIN` — accesso globale
- `ORGANIZER` — gestione evento
- `ENTRANCE` — solo check-in
- `SHUTTLE` — solo navette

### Enum `EventStatus`

- `ACTIVE` — evento in corso
- `PAUSED` — accessi sospesi temporaneamente
- `LOCKED` — evento chiuso

---

## Struttura Progetto

```text
Ingresso_festa/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma           # Schema DB completo
│   │   └── migrations/             # Migration SQLite
│   ├── src/
│   │   ├── config.ts               # Configurazione centralizzata
│   │   ├── server.ts               # Entry point + auto-sync avvio
│   │   ├── routes/
│   │   │   ├── index.ts            # Router principale
│   │   │   ├── auth.ts             # Login e gestione utenti
│   │   │   ├── events.ts           # CRUD feste
│   │   │   ├── invitees.ts         # Invitati + check-in + QR
│   │   │   ├── sync.ts             # Sync Google Sheets + reset
│   │   │   ├── settings.ts         # Impostazioni per-evento
│   │   │   ├── tshirts.ts          # Magliette
│   │   │   ├── expenses.ts         # Spese
│   │   │   ├── shuttles.ts         # Navette
│   │   │   ├── preregistrations.ts # Pre-registrazioni
│   │   │   ├── users.ts            # Utenti globali
│   │   │   ├── dashboard.ts        # Stats dashboard
│   │   │   └── health.ts           # Health check
│   │   ├── services/
│   │   │   ├── googleSheetsService.ts  # Lettura/scrittura Sheets
│   │   │   ├── syncService.ts          # Logica sync DB ↔ Sheets
│   │   │   ├── autoSync.ts             # Timer auto-sync (setInterval)
│   │   │   └── tshirtService.ts        # Sync magliette
│   │   ├── middleware/
│   │   │   ├── auth.ts             # JWT authenticate
│   │   │   └── eventAccess.ts      # Verifica ruolo per-evento
│   │   └── lib/
│   │       └── prisma.ts           # Prisma Client singleton
│   └── scripts/
│       ├── init-users.ts           # Inizializzazione utenti
│       └── users.example.json      # Esempio file utenti
│
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   └── invitees.ts         # Client HTTP (axios + TanStack Query)
│   │   ├── components/
│   │   │   ├── AppLayout.tsx       # Header scroll + hamburger + ToastContainer
│   │   │   ├── InviteeDetailModal.tsx
│   │   │   └── Toast.tsx           # Toast notification UI
│   │   ├── context/
│   │   │   ├── AuthContext.tsx
│   │   │   ├── EventContext.tsx
│   │   │   └── ToastContext.tsx    # Sistema notifiche toast
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx/css
│   │   │   ├── EventPickerPage.tsx/css
│   │   │   ├── SearchPage.tsx/css
│   │   │   ├── AdminDashboard.tsx/css
│   │   │   ├── PreRegistrationsPage.tsx/css
│   │   │   ├── TshirtsPage.tsx/css
│   │   │   ├── ShuttlesPage.tsx/css
│   │   │   ├── ExpensesPage.tsx/css
│   │   │   ├── UsersPage.tsx/css
│   │   │   ├── QrScanPage.tsx/css
│   │   │   └── RegisterPage.tsx/css
│   │   ├── App.tsx                 # Router + page transitions
│   │   ├── main.tsx                # Entry point + ToastProvider
│   │   └── index.css               # Design tokens globali (dark/light mode)
│   └── index.html
│
└── README.md
```

---

## Scripts Disponibili

### Backend scripts

```bash
npm run dev              # Development con hot reload
npm run build            # Compila TypeScript
npm run start            # Avvia build produzione
npm run prisma:generate  # Genera Prisma Client
npm run prisma:deploy    # Applica migrations
npm run users:import     # Importa utenti da users.json (idempotente)
npm run users:export     # Esporta utenti dal DB in JSON
```

### Frontend scripts

```bash
npm run dev              # Development server (Vite)
npm run build            # Build produzione
npm run preview          # Anteprima build
```

---

## Sicurezza

- Password hashing con bcrypt
- JWT con scadenza 12h
- Role-based access control a livello di evento
- Route admin invisibili (404) per utenti non autorizzati
- SQL injection protection via Prisma ORM
- CORS configurato per origini esplicite
- Helmet.js per HTTP security headers

---

## Troubleshooting

### Google Sheets restituisce dati vuoti

- Verifica che il foglio sia condiviso con il Service Account
- Controlla che il tab si chiami esattamente `Lista` / `GREEN`
- I dati devono iniziare da **riga 2** (riga 1 libera per intestazioni)
- Se `GOOGLE_SHEET_RANGE` non è impostato, il default è `Lista!A2:B`

### Errore "Unable to parse range: Magliette!..."

- Il modulo Magliette non è attivo per questa festa
- Verifica nelle impostazioni che il modulo sia disabilitato se il tab non esiste nel foglio

### Il reset fallisce con errore 500

- Controlla i log Render per il messaggio esatto
- Solitamente indica un tab mancante nel foglio o credenziali Google non valide

### Frontend non connette al backend

- Verifica `VITE_API_BASE_URL` nelle variabili d'ambiente del frontend
- Controlla che `FRONTEND_URL` sul backend includa l'URL del frontend (CORS)

### Migrazioni DB in produzione

- Lo start command esegue `prisma migrate deploy` ad ogni avvio
- Se vedi errori "column does not exist": ridistribuisci per applicare le migration pendenti

---

## Tech Stack

### Backend

- Node.js 20+ con TypeScript
- Express 5
- Prisma ORM + SQLite
- JWT (jsonwebtoken) + bcrypt
- Google Sheets API v4
- Winston (logging)

### Frontend

- React 19 con TypeScript
- Vite 6
- TanStack Query (React Query) per data fetching e cache
- React Router 7 con page transitions
- Axios
- CSS custom properties (design tokens per dark/light mode)

---

Sviluppato per SesaAperitivo