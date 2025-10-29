# 🔧 Fix Richiesti dall'Utente

## ✅ Fix già Completati

### 1. Header più piccolo e fisso
- Ridotto padding da `1rem` a `0.5rem`
- Font h1 da `1.5rem` a `1.125rem`
- Bottoni più piccoli
- Header rimane sticky (fisso in alto)

### 2. Rimosso emailService.ts
- Eliminato file obsoleto che causava errore build
- Commit e push già fatto

---

## 🚧 Fix da Implementare

### 1. Ricerca Istantanea (Rimovere Debounce)

**File**: `frontend/src/pages/SearchPage.tsx`

Cambiare:
```typescript
// PRIMA (con debounce lento):
const [debouncedQuery, setDebouncedQuery] = useState("");

useEffect(() => {
  const timer = setTimeout(() => {
    setDebouncedQuery(searchQuery);
  }, 300);
  return () => clearTimeout(timer);
}, [searchQuery]);

const { data: results = [] } = useQuery<Invitee[]>({
  queryKey: ["search", debouncedQuery],
  queryFn: () => searchInvitees(debouncedQuery),
  enabled: debouncedQuery.length >= 2,
});
```

Con:
```typescript
// DOPO (ricerca istantanea):
const { data: results = [] } = useQuery<Invitee[]>({
  queryKey: ["search", searchQuery],
  queryFn: () => searchInvitees(searchQuery),
  enabled: searchQuery.length >= 2,
});
```

Rimuovere anche:
- Import di `useEffect`
- Variabile `debouncedQuery`
- L'intero blocco `useEffect`
- Tutti i riferimenti a `debouncedQuery` nel JSX (sostituire con `searchQuery`)

---

### 2. Barra di Ricerca più Grande

**File**: `frontend/src/pages/SearchPage.css`

Aggiungere/Modificare:
```css
/* Barra di ricerca GRANDE */
.search-box {
  padding: 1.5rem 2rem; /* era 1rem 1.5rem */
  border-radius: 60px; /* era 50px */
}

.search-icon {
  width: 32px; /* era 24px */
  height: 32px;
  margin-right: 1.5rem; /* era 1rem */
}

.search-input {
  font-size: 1.5rem; /* era 1.125rem */
  font-weight: 500;
}
```

---

### 3. Fix Ordine Nome/Cognome

**File**: `frontend/src/pages/SearchPage.tsx`

Linea 141, cambiare:
```typescript
// PRIMA:
<div className="result-name">
  {person.lastName} {person.firstName}
</div>

// DOPO:
<div className="result-name">
  {person.firstName} {person.lastName}
</div>
```

**File**: `frontend/src/pages/AdminDashboard.tsx`

Cercare tutte le occorrenze di:
```typescript
{invitee.lastName} {invitee.firstName}
```

E cambiare in:
```typescript
{invitee.firstName} {invitee.lastName}
```

---

### 4. Aggiungere Barra Cerca nella Dashboard Admin

**File**: `frontend/src/pages/AdminDashboard.tsx`

Aggiungere dopo le statistiche e prima delle tab:
```typescript
const [searchFilter, setSearchFilter] = useState("");

// Filtrare le liste
const filteredPagantiList = pagantiList.filter(inv =>
  `${inv.firstName} ${inv.lastName}`.toLowerCase().includes(searchFilter.toLowerCase())
);

const filteredGreenList = greenList.filter(inv =>
  `${inv.firstName} ${inv.lastName}`.toLowerCase().includes(searchFilter.toLowerCase())
);

// Nel JSX, aggiungere prima delle tabs:
<div className="dashboard-search">
  <input
    type="text"
    placeholder="Cerca persona nella lista..."
    value={searchFilter}
    onChange={(e) => setSearchFilter(e.target.value)}
    className="dashboard-search-input"
  />
</div>

// E usare filteredPagantiList e filteredGreenList invece di pagantiList e greenList
```

**CSS da aggiungere** in `AdminDashboard.css`:
```css
.dashboard-search {
  margin-bottom: 1.5rem;
}

.dashboard-search-input {
  width: 100%;
  padding: 1rem 1.5rem;
  border: 2px solid #e5e7eb;
  border-radius: 12px;
  font-size: 1rem;
  transition: all 0.2s;
}

.dashboard-search-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}
```

---

### 5. Fix Credenziali Utenti

**Problema**: Gli utenti nel database potrebbero non corrispondere a quelli attesi.

**Soluzione**:

**Opzione A - Ricreare utenti localmente**:
```bash
cd backend
npx ts-node scripts/init-users.ts
```

**Opzione B - Aggiungere come variabili d'ambiente su Render**:

Su Render, aggiungi queste variabili al backend service:
- `ADMIN_USERNAME`: `admin`
- `ADMIN_PASSWORD`: (hash bcrypt della password `admin123`)
- Per generare l'hash: `npm run hash-password` nel backend

Utenti da creare:
1. **Admin**: `admin` / `admin123`
2. **Ingresso**: `ingresso1` / `ingresso123`

---

### 6. Fix Sincronizzazione Google Sheets

**Problema 1**: Database ha 181 persone, Google Sheets ha 178 (3 in più)

**Investigazione necessaria**:
```bash
# Nel backend, controllare:
cd backend
npx ts-node -e "
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
prisma.invitee.findMany().then(all => {
  console.log('Totale DB:', all.length);
  console.log('Paganti:', all.filter(i => i.listType === 'PAGANTE').length);
  console.log('Green:', all.filter(i => i.listType === 'GREEN').length);
  prisma.\$disconnect();
});
"
```

**Possibili cause**:
- Persone aggiunte manualmente dalla dashboard (non vanno su Sheets)
- Duplicati nel database
- Righe vuote in Google Sheets non contate

**Problema 2**: Aggiungere persona → non compare su Google Sheets

**Causa**: Non c'è sincronizzazione bidirezionale (DB → Sheets)

**Fix necessario**: Implementare funzione di scrittura su Google Sheets

**File**: `backend/src/services/googleSheetsService.ts`

Aggiungere:
```typescript
export async function writeToSheets(invitees: Array<{
  firstName: string;
  lastName: string;
  listType: 'PAGANTE' | 'GREEN';
  paymentType?: string;
}>) {
  const sheets = getGoogleSheetsClient();
  const { spreadsheetId } = config.googleSheets;

  // Prepara dati per Paganti
  const pagantiRows = invitees
    .filter(i => i.listType === 'PAGANTE')
    .map(i => [
      `${i.lastName} ${i.firstName}`,
      i.paymentType || ''
    ]);

  // Prepara dati per Green
  const greenRows = invitees
    .filter(i => i.listType === 'GREEN')
    .map(i => [`${i.lastName} ${i.firstName}`]);

  // Scrivi su Lista
  if (pagantiRows.length > 0) {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Lista!A:B',
      valueInputOption: 'RAW',
      requestBody: {
        values: pagantiRows
      }
    });
  }

  // Scrivi su GREEN
  if (greenRows.length > 0) {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'GREEN!A:A',
      valueInputOption: 'RAW',
      requestBody: {
        values: greenRows
      }
    });
  }
}
```

**File**: `backend/src/services/inviteeService.ts`

Modificare la funzione `createInvitee`:
```typescript
import { writeToSheets } from './googleSheetsService';

export const createInvitee = async (data: CreateInviteeDTO) => {
  const invitee = await prisma.invitee.create({ data });

  // Sincronizza con Google Sheets
  try {
    await writeToSheets([{
      firstName: invitee.firstName,
      lastName: invitee.lastName,
      listType: invitee.listType,
      paymentType: invitee.paymentType || undefined
    }]);
  } catch (error) {
    logger.error('Errore sincronizzazione Google Sheets:', error);
    // Non bloccare la creazione se la sync fallisce
  }

  return invitee;
};
```

**Permessi Google necessari**:
- Il Service Account deve avere permesso di **Editore** sul foglio Google Sheets
- Verificare su Google Sheets → Condividi → email del service account deve essere presente

---

## 📝 Checklist Implementazione

- [ ] Rimuovere debounce dalla ricerca
- [ ] Ingrandire barra di ricerca (CSS)
- [ ] Fix ordine nome/cognome in SearchPage
- [ ] Fix ordine nome/cognome in AdminDashboard
- [ ] Aggiungere barra cerca in AdminDashboard
- [ ] Verificare/ricreare utenti nel database
- [ ] Investigare discrepanza 181 vs 178
- [ ] Implementare sync bidirezionale (DB → Sheets)
- [ ] Testare aggiunta persona → verificare su Sheets
- [ ] Build e deploy

---

## 🚀 Comandi Rapidi

```bash
# 1. Verificare build frontend
cd frontend
npm run build

# 2. Verificare build backend
cd backend
npm run build

# 3. Ricreare utenti
cd backend
npx ts-node scripts/init-users.ts

# 4. Commit e push
git add .
git commit -m "Fix: ricerca istantanea, barra più grande, ordine nomi, ricerca dashboard, sync bidirezionale"
git push origin main

# 5. Deploy su Render
# Vai su dashboard.render.com e fai manual deploy
```

---

## ⚠️ Note Importanti

1. **Credenziali attuali**:
   - Admin: `admin` / `admin123`
   - Ingresso: `ingresso1` / `ingresso123`

2. **Google Sheets**:
   - Verifica permessi del Service Account
   - Deve essere "Editore" non solo "Visualizzatore"

3. **Sync**:
   - Attualmente: Sheets → DB (solo import)
   - Dopo fix: Sheets ↔ DB (bidirezionale)

4. **Performance**:
   - Ricerca istantanea potrebbe fare più chiamate API
   - Se diventa lento, considera di ridurre `refetchInterval` o aggiungere cache
