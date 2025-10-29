# 🚀 Modifiche Immediate da Applicare

## Priorità ALTA - Fix Immediati

### 1️⃣ SearchPage.tsx - Ricerca Istantanea + Nome Corretto

**File**: `frontend/src/pages/SearchPage.tsx`

**Riga 1**: Cambiare import
```typescript
// DA:
import { useState, useEffect } from "react";

// A:
import { useState } from "react";
```

**Righe 10-21**: ELIMINARE completamente
```typescript
// ELIMINARE TUTTO QUESTO BLOCCO:
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Debounce della ricerca
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);
```

**Righe 31-35**: Cambiare query
```typescript
// DA:
  const { data: results = [], isLoading } = useQuery<Invitee[]>({
    queryKey: ["search", debouncedQuery],
    queryFn: () => searchInvitees(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
  });

// A:
  const { data: results = [], isLoading } = useQuery<Invitee[]>({
    queryKey: ["search", searchQuery],
    queryFn: () => searchInvitees(searchQuery),
    enabled: searchQuery.length >= 2,
  });
```

**Righe 42-44**: Aggiungere invalidate invitees
```typescript
// DA:
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["search"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },

// A:
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["search"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["invitees"] });
    },
```

**Riga 112**: Cambiare condizione loading
```typescript
// DA:
        {isLoading && debouncedQuery.length >= 2 && (

// A:
        {isLoading && searchQuery.length >= 2 && (
```

**Riga 119**: Cambiare condizione empty
```typescript
// DA:
        {!isLoading && debouncedQuery.length >= 2 && results.length === 0 && (

// A:
        {!isLoading && searchQuery.length >= 2 && results.length === 0 && (
```

**Riga 127**: Cambiare testo
```typescript
// DA:
            <p>Nessuna persona trovata per "{debouncedQuery}"</p>

// A:
            <p>Nessuna persona trovata per "{searchQuery}"</p>
```

**Riga 131**: Cambiare condizione risultati
```typescript
// DA:
        {!isLoading && debouncedQuery.length >= 2 && results.length > 0 && (

// A:
        {!isLoading && searchQuery.length >= 2 && results.length > 0 && (
```

**Riga 141**: FIX ORDINE NOME!!! (IMPORTANTE)
```typescript
// DA:
                    <div className="result-name">
                      {person.lastName} {person.firstName}
                    </div>

// A:
                    <div className="result-name">
                      {person.firstName} {person.lastName}
                    </div>
```

---

### 2️⃣ SearchPage.css - Barra di Ricerca PIÙ GRANDE

**File**: `frontend/src/pages/SearchPage.css`

**Righe 75-84**: Sostituire .search-box
```css
/* DA: */
.search-box {
  position: relative;
  display: flex;
  align-items: center;
  background: white;
  border-radius: 50px;
  padding: 1rem 1.5rem;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
  transition: box-shadow 0.3s, transform 0.2s;
}

/* A: */
.search-box {
  position: relative;
  display: flex;
  align-items: center;
  background: white;
  border-radius: 60px;
  padding: 1.75rem 2.5rem;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
  transition: box-shadow 0.3s, transform 0.2s;
}
```

**Righe 91-97**: Sostituire .search-icon
```css
/* DA: */
.search-icon {
  width: 24px;
  height: 24px;
  color: #9ca3af;
  margin-right: 1rem;
  flex-shrink: 0;
}

/* A: */
.search-icon {
  width: 36px;
  height: 36px;
  color: #9ca3af;
  margin-right: 1.5rem;
  flex-shrink: 0;
}
```

**Righe 99-106**: Sostituire .search-input
```css
/* DA: */
.search-input {
  flex: 1;
  border: none;
  outline: none;
  font-size: 1.125rem;
  color: #1f2937;
  background: transparent;
}

/* A: */
.search-input {
  flex: 1;
  border: none;
  outline: none;
  font-size: 1.75rem;
  font-weight: 500;
  color: #1f2937;
  background: transparent;
}
```

---

### 3️⃣ AdminDashboard.tsx - Aggiungere Barra di Ricerca

**File**: `frontend/src/pages/AdminDashboard.tsx`

**Dopo `const [showAddForm, setShowAddForm] = useState(false);`** (circa riga 16), aggiungere:
```typescript
  const [searchFilter, setSearchFilter] = useState("");
```

**Dopo `const greenList = invitees.filter(inv => inv.listType === "GREEN");`** (circa riga 24), aggiungere:
```typescript
  // Filtra le liste in base alla ricerca
  const filteredPagantiList = pagantiList.filter(inv =>
    `${inv.firstName} ${inv.lastName}`.toLowerCase().includes(searchFilter.toLowerCase()) ||
    `${inv.lastName} ${inv.firstName}`.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const filteredGreenList = greenList.filter(inv =>
    `${inv.firstName} ${inv.lastName}`.toLowerCase().includes(searchFilter.toLowerCase()) ||
    `${inv.lastName} ${inv.firstName}`.toLowerCase().includes(searchFilter.toLowerCase())
  );
```

**Nel JSX, PRIMA delle tabs** (cerca `<div className="tabs">` e aggiungi PRIMA):
```tsx
      {/* Barra di ricerca */}
      <div className="dashboard-search-container">
        <svg className="dashboard-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="11" cy="11" r="8" strokeWidth="2"/>
          <path d="M21 21l-4.35-4.35" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        <input
          type="text"
          className="dashboard-search-input"
          placeholder="Cerca persona nelle liste..."
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
        />
        {searchFilter && (
          <button
            className="dashboard-search-clear"
            onClick={() => setSearchFilter("")}
            aria-label="Pulisci ricerca"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M18 6L6 18M6 6l12 12" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        )}
      </div>
```

**Nelle tabelle**, sostituire:
- `pagantiList.map` con `filteredPagantiList.map`
- `greenList.map` con `filteredGreenList.map`

**Cercare tutte le occorrenze** di:
```tsx
{invitee.lastName} {invitee.firstName}
```

E sostituire con:
```tsx
{invitee.firstName} {invitee.lastName}
```

---

### 4️⃣ AdminDashboard.css - Stile Barra di Ricerca

**File**: `frontend/src/pages/AdminDashboard.css`

**Aggiungere alla fine del file**:
```css
/* Dashboard Search */
.dashboard-search-container {
  position: relative;
  display: flex;
  align-items: center;
  background: white;
  border: 2px solid #e5e7eb;
  border-radius: 16px;
  padding: 1rem 1.5rem;
  margin-bottom: 2rem;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.dashboard-search-container:focus-within {
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.dashboard-search-icon {
  width: 24px;
  height: 24px;
  color: #9ca3af;
  margin-right: 1rem;
  flex-shrink: 0;
}

.dashboard-search-input {
  flex: 1;
  border: none;
  outline: none;
  font-size: 1rem;
  color: #1f2937;
  background: transparent;
}

.dashboard-search-input::placeholder {
  color: #9ca3af;
}

.dashboard-search-clear {
  background: #f3f4f6;
  border: none;
  border-radius: 50%;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.2s;
  flex-shrink: 0;
}

.dashboard-search-clear:hover {
  background: #e5e7eb;
}

.dashboard-search-clear svg {
  width: 14px;
  height: 14px;
  color: #6b7280;
}
```

---

### 5️⃣ Google Sheets - Sync Bidirezionale

**File**: `backend/src/services/googleSheetsService.ts`

**Aggiungere questa funzione ALLA FINE del file**:
```typescript
/**
 * Scrive nuove persone su Google Sheets
 */
export async function addPersonToSheets(person: {
  firstName: string;
  lastName: string;
  listType: 'PAGANTE' | 'GREEN';
  paymentType?: string | null;
}) {
  const sheets = getGoogleSheetsClient();
  const { spreadsheetId } = config.googleSheets;

  const fullName = `${person.lastName} ${person.firstName}`;

  if (person.listType === 'PAGANTE') {
    // Aggiungi a Lista (Paganti)
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Lista!A:B',
      valueInputOption: 'RAW',
      requestBody: {
        values: [[fullName, person.paymentType || '']]
      }
    });
    logger.info(`Aggiunto a Google Sheets (Lista): ${fullName}`);
  } else {
    // Aggiungi a GREEN
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'GREEN!A:A',
      valueInputOption: 'RAW',
      requestBody: {
        values: [[fullName]]
      }
    });
    logger.info(`Aggiunto a Google Sheets (GREEN): ${fullName}`);
  }
}
```

---

**File**: `backend/src/services/inviteeService.ts`

**Importare la funzione** (all'inizio del file):
```typescript
import { addPersonToSheets } from './googleSheetsService';
```

**Nella funzione `createInvitee`**, aggiungere DOPO la creazione:
```typescript
export const createInvitee = async (data: CreateInviteeDTO): Promise<Invitee> => {
  const invitee = await prisma.invitee.create({
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      listType: data.listType,
      paymentType: data.paymentType,
    },
  });

  // AGGIUNGERE QUESTO BLOCCO:
  // Sincronizza con Google Sheets
  try {
    await addPersonToSheets({
      firstName: invitee.firstName,
      lastName: invitee.lastName,
      listType: invitee.listType,
      paymentType: invitee.paymentType
    });
  } catch (error) {
    logger.error('Errore sincronizzazione Google Sheets:', error);
    // Non bloccare la creazione se la sync fallisce
  }

  return invitee;
};
```

---

### 6️⃣ Verificare Permessi Google Sheets

1. Apri il tuo Google Sheet: https://docs.google.com/spreadsheets/d/1ufEQZd1bvjfyEgvBXzNvg_L-oBjVXPDZmynGE8Sfxug/edit
2. Clicca su **Condividi** (in alto a destra)
3. Verifica che l'email del service account sia presente:
   - Email: `ingresso-festa-sync@lista-festa-8-novembre.iam.gserviceaccount.com`
   - Ruolo: **Editore** (NON "Visualizzatore")
4. Se non è presente o è "Visualizzatore", aggiungila come **Editore**

---

## ✅ Checklist

- [ ] SearchPage.tsx - Rimosso debounce
- [ ] SearchPage.tsx - Fix ordine nome (firstName lastName)
- [ ] SearchPage.css - Barra di ricerca più grande
- [ ] AdminDashboard.tsx - Aggiunta barra ricerca
- [ ] AdminDashboard.tsx - Fix ordine nome
- [ ] AdminDashboard.css - Stile barra ricerca
- [ ] googleSheetsService.ts - Funzione addPersonToSheets
- [ ] inviteeService.ts - Chiamata sync dopo createInvitee
- [ ] Google Sheets - Verificato permesso Editore
- [ ] Build backend: `npm run build`
- [ ] Build frontend: `npm run build`
- [ ] Commit e push
- [ ] Deploy su Render

---

## 🚀 Comandi Finali

```bash
# Test build
cd frontend && npm run build && cd ..
cd backend && npm run build && cd ..

# Commit
git add .
git commit -m "Fix: ricerca istantanea, barra grande, ordine nomi, ricerca dashboard, sync bidirezionale Google Sheets"
git push origin main

# Poi vai su Render e fai Manual Deploy
```

---

## 📝 Note

**Credenziali corrette**:
- Admin: `admin` / `admin123`
- Ingresso: `ingresso1` / `ingresso123`

Se non funzionano in produzione, esegui su Render (nel backend service, Shell tab):
```bash
npx ts-node scripts/init-users.ts
```

**Discrepanza 181 vs 178**:
Probabilmente 3 persone sono state aggiunte manualmente dalla dashboard e non erano su Google Sheets. Dopo aver implementato la sync bidirezionale, questo problema non si ripeterà.
