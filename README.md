# 🎉 Festa 8 Novembre - Sistema di Gestione Ingressi

Sistema moderno per la gestione degli ingressi alla festa, con ricerca in tempo reale, sincronizzazione Google Sheets e interfacce separate per Admin e operatori all'ingresso.

![Version](https://img.shields.io/badge/version-2.0.0-blue)
![Node](https://img.shields.io/badge/node-%3E%3D20-green)
![TypeScript](https://img.shields.io/badge/typescript-5.6-blue)
![React](https://img.shields.io/badge/react-19-blue)

## ✨ Caratteristiche Principali

### 🎯 Per gli Utenti Ingresso
- **Ricerca Istantanea**: Trova persone digitando nome o cognome
- **Check-in Veloce**: Bottone verde/rosso per marcare gli ingressi
- **Contatori Live**: Visualizza in tempo reale quante persone devono ancora entrare
- **Interface Moderna**: Design intuitivo e responsive

### 👑 Per gli Admin
- **Dashboard Completa**: Gestione totale di entrambe le liste (Paganti e Green)
- **Aggiungi Persone**: Form semplice per inserire nuovi ospiti
- **Sincronizzazione Google Sheets**: Importa automaticamente da due tabelle
- **Controllo Totale**: Elimina, modifica e resetta gli stati di ingresso
- **Statistiche Real-time**: Monitora l'andamento della festa

### 🔄 Integrazione Google Sheets
- **Due Liste Separate**:
  - **Lista** (Paganti): Cognome Nome + Tipologia Pagamento
  - **GREEN**: Cognome Nome (ospiti non paganti)
- **Sincronizzazione Automatica**: Ogni 10 minuti (configurabile)
- **Sincronizzazione Manuale**: Bottone nella dashboard admin

## 🚀 Quick Start

### Prerequisiti
- Node.js >= 20
- npm o yarn
- Account Google Cloud con Service Account (per Google Sheets)

### Installazione

#### 1. Backend Setup
```bash
cd backend

# Installa dipendenze
npm install

# Copia e configura environment variables
# Il file .env.local è già configurato, copialo in .env se necessario

# Genera Prisma Client
npm run prisma:generate

# Applica migrations (già applicate)
npm run prisma:deploy

# Inizializza utenti (GIÀ FATTO - admin e ingresso1 esistono)
# npx ts-node scripts/init-users.ts

# Avvia server
npm run dev
```

#### 2. Frontend Setup
```bash
cd frontend

# Installa dipendenze
npm install

# Avvia development server
npm run dev
```

#### 3. Accedi
Apri il browser: `http://localhost:5173`

**Credenziali di default:**
- **Admin**: `admin` / `admin123`
- **Ingresso**: `ingresso1` / `ingresso123`

⚠️ **IMPORTANTE**: Cambia queste password in produzione!

## 📋 Configurazione Google Sheets

### Struttura Foglio "Festa 8 Novembre"

#### Tabella "Lista" (Paganti)
| A: Cognome Nome | B: Tipologia Pagamento |
|----------------|------------------------|
| Rossi Mario    | bonifico               |
| Verdi Luigi    | paypal                 |

#### Tabella "GREEN" (Non Paganti)
| A: Cognome Nome  |
|-----------------|
| Bianchi Anna    |
| Neri Paolo      |

### Environment Variables (già configurato in .env.local)
```env
GOOGLE_SHEET_ID=1ufEQZd1bvjfyEgvBXzNvg_L-oBjVXPDZmynGE8Sfxug
GOOGLE_SHEET_RANGE=Lista!A2:B
GOOGLE_SHEET_GREEN_RANGE=GREEN!A:A
GOOGLE_SHEETS_AUTO_SYNC=true
GOOGLE_SHEETS_SYNC_INTERVAL=10
```

## 🎨 Interfacce

### Login Page
- Background animato con orb fluttuanti
- Form moderno con validazione
- Redirect automatico basato sul ruolo

### Search Page (per tutti)
- Barra di ricerca con debounce
- 3 contatori in tempo reale:
  - Paganti da entrare
  - Green da entrare
  - Totale entrati
- Risultati con badge tipo lista
- Bottone verde/rosso per check-in

### Admin Dashboard
- Tab separati per Paganti e Green
- Form per aggiungere persone
- Bottone sincronizzazione Google Sheets
- Tabella completa con azioni:
  - Toggle stato entrato/non entrato
  - Elimina persona

## 🔐 Ruoli e Permessi

### ADMIN
- ✅ Accesso a Dashboard e Ricerca
- ✅ Aggiungere/Eliminare persone
- ✅ Marcare come entrato
- ✅ **Rimettere come non entrato** (unico ruolo che può farlo)
- ✅ Sincronizzare Google Sheets

### ENTRANCE
- ✅ Accesso solo a Ricerca
- ✅ Cercare persone
- ✅ Marcare come entrato (verde → rosso)
- ❌ Non può rimettere come non entrato
- ❌ Non può eliminare/aggiungere
- ❌ Non può accedere alla dashboard

## 📁 Struttura Progetto

```
Ingresso_festa/
├── backend/
│   ├── src/
│   │   ├── routes/          # API endpoints
│   │   ├── services/        # Business logic
│   │   ├── middleware/      # Auth, validation
│   │   ├── lib/             # Prisma client
│   │   └── server.ts        # Entry point
│   ├── prisma/
│   │   ├── schema.prisma    # Database schema
│   │   └── migrations/      # Database migrations
│   └── scripts/
│       └── init-users.ts    # User initialization
│
├── frontend/
│   ├── src/
│   │   ├── api/             # API client
│   │   ├── components/      # React components
│   │   ├── context/         # Auth context
│   │   ├── pages/
│   │   │   ├── AdminDashboard.tsx  # Dashboard admin
│   │   │   ├── SearchPage.tsx      # Pagina ricerca
│   │   │   └── LoginPage.tsx       # Login
│   │   └── App.tsx
│   └── package.json
│
├── storage/
│   └── data/
│       └── dev.db           # SQLite database
│
├── README.md                # Questo file
├── NUOVO_SISTEMA.md         # Documentazione backend
└── FRONTEND_COMPLETO.md     # Documentazione frontend
```

## 🗄️ Database

### Tables

#### Invitee
- `id`: Unique identifier
- `firstName`: Nome
- `lastName`: Cognome
- `listType`: PAGANTE | GREEN
- `paymentType`: Tipologia pagamento (solo PAGANTE)
- `hasEntered`: Boolean (true = entrato, false = non entrato)
- `checkedInAt`: Timestamp ingresso

#### User
- `id`: Unique identifier
- `username`: Username login
- `password`: Password hashed (bcrypt)
- `role`: ADMIN | ENTRANCE
- `active`: Boolean (true = può accedere; false = disattivato)

#### SystemConfig
- `eventName`: Nome evento
- `eventStatus`: ACTIVE | PAUSED | LOCKED

## 🔧 Scripts Disponibili

### Backend
```bash
npm run dev          # Development server con hot reload
npm run build        # Build production
npm run start        # Avvia production build
npm run prisma:generate   # Genera Prisma Client
npm run prisma:deploy     # Applica migrations
npm run users:import      # Importa/aggiorna utenti da users.json (idempotente)
npm run users:export      # Esporta utenti dal DB in JSON (con hash)
```

### Frontend
```bash
npm run dev          # Development server
npm run build        # Build production
npm run preview      # Preview build
```

## 🌐 API Endpoints

### Authentication
- `POST /api/auth/login` - Login
- `POST /api/auth/users` - Crea utente (admin only)
- `GET /api/auth/users` - Lista utenti (admin only)
- `PATCH /api/auth/users/:id` - Attiva/Disattiva utente (admin only)
- `DELETE /api/auth/users/:id` - Elimina utente (admin only)

### Invitees
- `GET /api/invitees` - Lista tutti
- `GET /api/invitees/search?q=query` - Ricerca
- `GET /api/invitees/stats` - Statistiche
- `POST /api/invitees` - Crea
- `POST /api/invitees/:id/checkin` - Check-in
- `DELETE /api/invitees/:id` - Elimina (admin only)

### Sync
- `POST /api/sync/google-sheets` - Sincronizza (admin only)

Gli endpoint riservati agli admin rispondono 404 ai non‑admin (invisibili).

## 🚀 Deploy su Render (aggiornato)

### Backend (Web Service)
- Root: `Ingresso_festa/backend`
- Build Command: `npm ci && npm run build`
- Start Command (consigliato):
  - `npx prisma migrate deploy && npm run users:import -- users.json && node dist/server.js`
  - Fallback (se mancano migration): `npx prisma migrate deploy || npx prisma db push && node dist/server.js`
- Environment (minimo):
  - `DATABASE_URL` → es. SQLite con Persistent Disk: `file:/var/data/ingresso.db`
  - `JWT_SECRET` → segreto robusto
  - `FRONTEND_URL` → URL frontend per CORS
  - `GOOGLE_SHEET_ID`, `GOOGLE_SHEET_RANGE=Lista!A2:B`, `GOOGLE_SHEET_GREEN_RANGE=GREEN!A:A`, `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_SHEETS_AUTO_SYNC=true`, `GOOGLE_SHEETS_SYNC_INTERVAL=10`
  - Facoltative:
    - `DISABLE_ENV_ADMIN_FALLBACK=true` (usa solo utenti DB)
    - `NPM_CONFIG_PRODUCTION=false` (permette `ts-node` negli script npm)
- Secret Files:
  - Aggiungi `users.json` (vedi `backend/users.example.json`). Password meglio hashate (`npm run hash-password -- <pwd>`), altrimenti verranno hashate all’import.

### Frontend (Static Site o Web Service)
- Root: `Ingresso_festa/frontend`
- Build Command: `npm ci && npm run build`
- Env: `VITE_API_BASE_URL` → URL backend (es. `https://<tuo-backend>.onrender.com/api`)

### Migrazioni DB in produzione
- Le migration sono in `backend/prisma/migrations/`.
- Lo Start esegue `prisma migrate deploy` ad ogni avvio: ridistribuisci dopo modifiche schema (es. aggiunta `User.active`).
- Se vedi errori tipo "column ... does not exist": ridistribuisci per applicare la nuova migration o usa il fallback con `prisma db push`.

## 🎯 Features Tecniche

### Frontend
- **React 19** con Hooks
- **TypeScript** per type safety
- **React Query** per state management
- **React Router 7** per routing
- **Axios** per HTTP requests
- **Vite** come build tool

### Backend
- **Node.js 20+** con TypeScript
- **Express 5** per API
- **Prisma** ORM con SQLite
- **JWT** per autenticazione
- **bcrypt** per password hashing
- **Google Sheets API** per sincronizzazione

## 🔒 Sicurezza

- ✅ Password hashed con bcrypt
- ✅ JWT token con scadenza 12h
- ✅ Role-based access control
- ✅ Protected routes
- ✅ SQL injection protection (Prisma)
- ✅ CORS configurato
- ✅ Helmet.js headers

## 🐛 Troubleshooting

### Backend non si avvia
```bash
# Verifica variabili environment
cat backend/.env.local

# Rigenera Prisma Client
cd backend && npm run prisma:generate
```

### Frontend non connette al backend
Verifica che il backend sia in ascolto su porta 8000

### Google Sheets non sincronizza
- Verifica che il foglio sia condiviso con il Service Account
- Controlla GOOGLE_SHEET_ID in .env.local
- Verifica i range (Lista!A2:B e GREEN!A:A)

## 📄 Licenza

MIT License

## 🙏 Credits

Sviluppato con ❤️ per la Festa 8 Novembre

---

**Ready to party! 🎊**

Per documentazione dettagliata:
- [NUOVO_SISTEMA.md](./NUOVO_SISTEMA.md) - Backend details
- [FRONTEND_COMPLETO.md](./FRONTEND_COMPLETO.md) - Frontend details

---

## Panoramica Rapida

- Scopo: gestione ingressi con ruoli diversi (Admin, Ingresso), ricerca istantanea, check‑in con contatori live, import e sync da Google Sheets.
- Backend: Node.js/TypeScript + Express + Prisma/SQLite; Frontend: React + Vite (+ TanStack Query/Router).
- Deploy: configurabile su Render; credenziali di default presenti per sviluppo (da cambiare in produzione).

## Struttura Cartelle

- `backend/`
  - `src/routes/` – API endpoints (auth, persone, sync, ecc.).
  - `src/services/` – Logica applicativa (gestione liste, check‑in).
  - `src/middleware/` – Autenticazione, validazioni, sicurezza.
  - `src/lib/` – Prisma Client e util.
  - `src/server.ts` – Entry point server.
  - `prisma/schema.prisma` – Modello DB; `migrations/` – migrazioni.
  - `scripts/` – Inizializzazione e util (es. utenti).
  - `storage/data/dev.db` – DB SQLite locale per sviluppo.
- `frontend/`
  - `src/api/` – Client HTTP.
  - `src/components/` – Componenti UI.
  - `src/context/` – Stato auth/utente.
  - `src/pages/` – `AdminDashboard`, `SearchPage`, `LoginPage`.

## Azioni Possibili

- Avvio sviluppo: `cd backend && npm install && npm run dev` e `cd ../frontend && npm install && npm run dev` → `http://localhost:5173`.
- Login di prova: `admin/admin123`, `ingresso1/ingresso123` (cambiare in produzione!).
- Import/sync Google Sheets: configurare variabili in backend (vedi README/ENV) e usare pulsante nella dashboard admin.
- Gestione liste: aggiungi/elimina persone, check‑in, reset stato (solo Admin può ripristinare).

## Siti/Strumenti Utili

- Prisma ORM: https://www.prisma.io/docs
- SQLite: https://www.sqlite.org/docs.html
- Google Sheets API: https://developers.google.com/sheets/api
- Express: https://expressjs.com
- React: https://react.dev • Vite: https://vitejs.dev
- TanStack Query: https://tanstack.com/query/latest
- JSON Web Tokens: https://jwt.io • bcryptjs: https://github.com/dcodeIO/bcrypt.js
- Helmet (sicurezza): https://helmetjs.github.io
