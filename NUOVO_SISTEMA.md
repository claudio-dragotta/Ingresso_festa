# Nuovo Sistema di Gestione Ingressi - Senza QR

## Panoramica delle Modifiche

Il sistema è stato completamente rivoluzionato per eliminare i codici QR e implementare un sistema di gestione ingressi basato su ricerca nome/cognome.

## Modifiche al Database

### Nuovo Schema Prisma

#### Model Invitee (Aggiornato)
- **Rimossi**: `token`, `qrFilename`, `qrMimeType`, `status`, `checkInCount`, `lastSentAt`
- **Aggiunti**:
  - `listType`: PAGANTE | GREEN (identifica se la persona è nella lista paganti o green)
  - `hasEntered`: Boolean (true = entrato/rosso, false = non entrato/verde)

#### Model User (Nuovo)
- `id`: String (CUID)
- `username`: String (unique)
- `password`: String (hashed con bcrypt)
- `role`: UserRole (ADMIN | ENTRANCE)
- `createdAt`: DateTime
- `updatedAt`: DateTime

#### Enum ListType (Nuovo)
- `PAGANTE`: Persona nella lista paganti (con tipologia pagamento)
- `GREEN`: Persona nella lista green (senza pagamento)

#### Enum UserRole (Nuovo)
- `ADMIN`: Può fare tutto (aggiungere/eliminare persone, vedere liste complete, gestire utenti)
- `ENTRANCE`: Può solo cercare e marcare come entrato (no elimina, no reset se già entrato)

### Migration Eseguita
✅ Migration `20251029210248_remove_qr_add_list_type` applicata con successo

## Modifiche Backend

### Services Aggiornati

#### inviteeService.ts
- **Rimosso**: Tutta la logica QR code, email sending, token generation
- **Aggiunto**:
  - `searchInvitees(query)`: Ricerca persone per nome/cognome (case-insensitive)
  - `markCheckIn(inviteeId, adminOverride)`: Toggle entrato/non entrato
  - `getStats()`: Statistiche per i contatori (paganti/green da entrare/entrati)

#### googleSheetsService.ts
- **Aggiornato** per supportare DUE fogli:
  - `readPagantiSheet()`: Legge da "Lista!A2:B" (Cognome Nome + Tipologia Pagamento)
  - `readGreenSheet()`: Legge da "GREEN!A:A" (solo Cognome Nome)
  - `fetchAndParseGoogleSheets()`: Combina entrambe le liste
  - `writeToGoogleSheet(fullName, listType, paymentType)`: Scrive sul foglio appropriato

#### syncService.ts
- **Aggiornato** per sincronizzare entrambe le liste (PAGANTI + GREEN)
- Statistiche dettagliate: breakdown per tipo lista

#### authService.ts
- **Aggiornato** per supportare utenti dal database
- `login()`: Controlla database prima, fallback su env variables
- `createUser()`: Crea nuovi utenti (solo admin)
- `listUsers()`: Lista utenti (solo admin)
- `deleteUser()`: Elimina utenti (solo admin)

#### systemService.ts
- **Aggiornato** per le nuove metriche (hasEntered invece di status)

### Routes Aggiornate

#### /api/invitees
- `GET /invitees`: Lista tutti gli invitati
- `GET /invitees/search?q=mario`: Ricerca invitati
- `GET /invitees/stats`: Statistiche per i contatori
- `POST /invitees`: Crea nuovo invitato (richiede listType)
- `POST /invitees/:id/checkin`: Marca come entrato/non entrato
- `PATCH /invitees/:id/reset`: Reset check-in (solo admin)
- `DELETE /invitees/:id`: Elimina invitato (solo admin)

#### /api/auth
- `POST /auth/login`: Login (ritorna token + role)
- `POST /auth/users`: Crea utente (solo admin)
- `GET /auth/users`: Lista utenti (solo admin)
- `DELETE /auth/users/:id`: Elimina utente (solo admin)

#### /api/checkin
- **RIMOSSA**: Non più necessaria (check-in tramite ID persona)

### File Rimossi/Non Utilizzati
- `backend/src/routes/checkin.ts` - Route token-based check-in
- `backend/src/services/qrService.ts` - Generazione QR codes
- `backend/src/services/tokenService.ts` - Token HMAC signing
- `storage/qrcodes/` - Directory QR codes generati

## Configurazione Google Sheets

### Variabili Environment (.env)

Aggiunto:
```env
GOOGLE_SHEET_GREEN_RANGE=GREEN!A:A
```

Aggiornato:
```env
GOOGLE_SHEET_RANGE=Lista!A2:B  # Ora include colonna B per tipologia pagamento
```

### Struttura Fogli Google

#### Foglio "Lista" (Paganti)
- **Colonna A**: Cognome Nome (es: "Rossi Mario")
- **Colonna B**: Tipologia Pagamento (es: "bonifico", "paypal", "contanti", "p2p")

#### Foglio "GREEN" (Non Paganti)
- **Colonna A**: Cognome Nome (es: "Verdi Luigi")

## Utenti Creati

### Script di Inizializzazione
File: `backend/scripts/init-users.ts`

Eseguito con successo, creati:
1. **Admin**
   - Username: `admin`
   - Password: `admin123`
   - Role: `ADMIN`

2. **Utente Ingresso**
   - Username: `ingresso1`
   - Password: `ingresso123`
   - Role: `ENTRANCE`

⚠️ **IMPORTANTE**: Cambiare queste password in produzione!

## Funzionalità per Tipo Utente

### ADMIN
Può:
- Vedere dashboard completa con entrambe le liste (PAGANTI e GREEN)
- Aggiungere nuove persone (sia paganti che green)
- Eliminare persone
- Modificare stato ingresso (può rimettere come "non entrato")
- Vedere pagina ricerca con contatori
- Gestire utenti (creare/eliminare utenti ENTRANCE)

### ENTRANCE (Utenti Ingresso)
Può:
- Vedere SOLO pagina ricerca
- Cercare persone per nome/cognome
- Marcare come "entrato" (bottone verde → rosso)
- **NON può**:
  - Rimettere come "non entrato" (bottone rosso bloccato)
  - Eliminare persone
  - Aggiungere persone
  - Vedere dashboard completa

## Logica Check-in

### Bottone Verde/Rosso
- **Verde** = Non entrato (`hasEntered: false`)
- **Rosso** = Entrato (`hasEntered: true`)

### Comportamento Click
- **Utente ENTRANCE** click su verde → diventa rosso (entrato)
- **Utente ENTRANCE** click su rosso → NESSUN EFFETTO (bloccato)
- **Admin** click su verde → diventa rosso (entrato)
- **Admin** click su rosso → diventa verde (reimpostato come non entrato)

### Contatori in Tempo Reale
- **Paganti da entrare**: `count(listType=PAGANTE AND hasEntered=false)`
- **Green da entrare**: `count(listType=GREEN AND hasEntered=false)`
- **Totale entrati**: `count(hasEntered=true)`

## Prossimi Passi - Frontend

### Da Completare
1. **Rimuovere ScannerPage** e tutti i riferimenti QR dal frontend
2. **Creare nuova Dashboard Admin**:
   - Due liste separate (PAGANTI e GREEN)
   - Form per aggiungere PAGANTI (nome, cognome, tipologia pagamento)
   - Form per aggiungere GREEN (nome, cognome)
   - Bottoni per eliminare record
   - Visualizzazione stato ingresso per ogni persona
   - Possibilità di reset per admin

3. **Creare nuova pagina Ricerca** (per utenti ENTRANCE):
   - Barra di ricerca con risultati in tempo reale
   - Contatori in alto (paganti da entrare, green da entrare, totale entrati)
   - Risultati con bottone verde/rosso
   - Logica bottone: verde→rosso (utenti), verde↔rosso (admin)

4. **Aggiornare Login Page** per mostrare il ruolo dopo login

5. **Aggiornare Routing**:
   - Rimuovere `/scanner`
   - Admin: `/dashboard` (completa) + `/search`
   - Entrance: `/search` (solo questa pagina)

## Test Backend

### Come Testare

1. **Avvia backend**:
   ```bash
   cd backend
   npm run dev
   ```

2. **Test Login Admin**:
   ```bash
   curl -X POST http://localhost:8000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username":"admin","password":"admin123"}'
   ```

3. **Test Login Entrance**:
   ```bash
   curl -X POST http://localhost:8000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username":"ingresso1","password":"ingresso123"}'
   ```

4. **Test Ricerca** (con token):
   ```bash
   curl -X GET "http://localhost:8000/api/invitees/search?q=mario" \
     -H "Authorization: Bearer YOUR_TOKEN_HERE"
   ```

5. **Test Statistiche**:
   ```bash
   curl -X GET http://localhost:8000/api/invitees/stats \
     -H "Authorization: Bearer YOUR_TOKEN_HERE"
   ```

6. **Test Sync Google Sheets**:
   ```bash
   curl -X POST http://localhost:8000/api/sync/google-sheets \
     -H "Authorization: Bearer YOUR_TOKEN_HERE"
   ```

## Note Importanti

1. ✅ Backend completamente rivoluzionato e funzionante
2. ✅ Database migrato con successo
3. ✅ Utenti admin e entrance creati
4. ✅ Google Sheets integration aggiornata per due liste
5. ⏳ Frontend da aggiornare completamente
6. ⏳ Rimuovere dipendenze QR (`qrcode`, `@zxing/browser`)

## Comando per Avviare

### Backend
```bash
cd backend
npm run dev
```

Il backend è pronto e funzionante! Ora serve aggiornare il frontend per completare la rivoluzione del sistema.
