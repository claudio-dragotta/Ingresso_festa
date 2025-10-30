# Sincronizzazione Bidirezionale Google Sheets

## Problema Risolto

### Problemi Identificati
1. ❌ Quando aggiungevi un nuovo invitato dall'admin, veniva salvato solo nel database locale, NON su Google Sheets
2. ✅ I campi email e telefono erano già presenti nel form (nessuna modifica necessaria)

### Soluzione Implementata
Ora quando aggiungi un nuovo invitato dalla dashboard admin:
1. ✅ Viene salvato nel **database locale** (SQLite/Render)
2. ✅ Viene **automaticamente scritto su Google Sheets**
3. ✅ Mantiene email e telefono nel database (Google Sheets salva solo nome e tipologia)

## Come Funziona

### Aggiunta Invitato dall'Admin
```
Frontend (Admin Dashboard)
   ↓
   | Invia richiesta POST /api/invitees
   ↓
Backend (inviteeService.ts)
   ↓
   | 1. Crea invitato nel database locale
   | 2. Scrive contemporaneamente su Google Sheets
   ↓
Google Sheets aggiornato automaticamente
```

### Sincronizzazione da Google Sheets
```
Google Sheets
   ↓
   | Bottone "Sincronizza" nella dashboard
   ↓
Backend legge entrambi i fogli (PAGANTI + GREEN)
   ↓
   | Importa solo le persone NUOVE
   | (Non sovrascrive quelle esistenti)
   ↓
Database locale aggiornato
```

## Discrepanza Trovata

Durante l'analisi ho trovato **1 persona nel database che non esiste su Google Sheets**:
- **Nome**: Momo Nome
- **Lista**: PAGANTE
- **Pagamento**: bonifico

### Perché Succede?
Il database persistente da 1GB su Render mantiene i dati tra i deploy. Se qualcuno è stato aggiunto manualmente prima di implementare la sincronizzazione bidirezionale, rimane solo nel DB.

### Come Risolvere

**Opzione 1 - Rimuovi la persona dal database**
Se "Momo Nome" non dovrebbe esistere:
```bash
cd backend
npx ts-node -e "import { prisma } from './src/lib/prisma'; prisma.invitee.deleteMany({ where: { lastName: 'Momo' } }).then(() => console.log('Rimosso')).finally(() => process.exit(0));"
```

**Opzione 2 - Aggiungi su Google Sheets**
Se "Momo Nome" dovrebbe esistere:
1. Apri il foglio "Festa 8 Novembre" su Google Sheets
2. Vai nella tabella "Lista"
3. Aggiungi una riga con:
   - Colonna A: `Momo Nome`
   - Colonna B: `bonifico`

**Opzione 3 - Reset completo** (sconsigliato se ci sono check-in già effettuati)
```bash
cd backend
npx ts-node scripts/reset-and-sync.ts
```
⚠️ **ATTENZIONE**: Questo cancellerà TUTTI gli invitati e reimporterà solo quelli dal foglio Google. I dati di check-in andranno persi!

## Script Utili

### Verifica sincronizzazione
Controlla se ci sono discrepanze tra DB e Google Sheets:
```bash
cd backend
npx ts-node scripts/check-sync.ts
```

### Test sincronizzazione bidirezionale
Testa che la scrittura su Google Sheets funzioni:
```bash
cd backend
npx ts-node scripts/test-bidirectional-sync.ts
```

### Sincronizzazione manuale
Importa nuove persone da Google Sheets senza cancellare quelle esistenti:
```bash
cd backend
npx ts-node scripts/reset-and-sync.ts
```

## Struttura Google Sheets

### Foglio "Lista" (PAGANTI)
| Colonna A | Colonna B |
|-----------|-----------|
| Cognome Nome | Tipologia Pagamento |
| Rossi Mario | bonifico |
| Verdi Luigi | paypal |

### Foglio "GREEN" (Non paganti)
| Colonna A |
|-----------|
| Cognome Nome |
| Bianchi Anna |
| Neri Paolo |

## Limitazioni

### Cosa NON viene sincronizzato su Google Sheets:
- **Email**: Salvata solo nel database locale
- **Telefono**: Salvato solo nel database locale
- **Stato ingresso** (hasEntered): Salvato solo nel database locale
- **Timestamp check-in**: Salvato solo nel database locale

### Perché?
Google Sheets è usato come "lista master" delle persone invitate. I dati operativi (chi è entrato, contatti, ecc.) sono gestiti solo nel database locale per performance e sicurezza.

## Verifica Funzionalità

1. **Apri la dashboard admin** (con utente `admin`)
2. **Aggiungi una nuova persona**:
   - Nome: Mario
   - Cognome: Test
   - Email: mario.test@example.com
   - Telefono: +39 123 456 7890
   - Tipologia: bonifico
3. **Controlla Google Sheets**:
   - Apri il foglio "Festa 8 Novembre"
   - Vai nella tabella "Lista"
   - Dovresti vedere una nuova riga in fondo: `Test Mario | bonifico`
4. **Verifica nel database**:
   ```bash
   cd backend
   npx ts-node scripts/check-sync.ts
   ```

## In Caso di Problemi

### La persona non appare su Google Sheets
1. Controlla i log del backend (cerca errori con "Google Sheets")
2. Verifica le credenziali del Service Account in `.env.local`
3. Assicurati che il foglio sia condiviso con il Service Account email

### Duplicati
Se vedi duplicati, probabilmente hai aggiunto la stessa persona:
1. Dall'admin dashboard (viene scritto su Sheets)
2. Direttamente su Google Sheets

**Soluzione**: Rimuovi il duplicato da Google Sheets manualmente

### Sincronizzazione non funziona
```bash
# Test connessione a Google Sheets
cd backend
npx ts-node -e "import { testGoogleSheetsConnection } from './src/services/googleSheetsService'; testGoogleSheetsConnection().then(() => process.exit(0));"
```

## Modifiche Tecniche

### File Modificati
- `backend/src/services/inviteeService.ts`: Aggiunta chiamata a `writeToGoogleSheet()` dopo la creazione dell'invitato
- `backend/scripts/check-sync.ts`: Nuovo script per verificare discrepanze
- `backend/scripts/test-bidirectional-sync.ts`: Nuovo script per testare la sincronizzazione bidirezionale

### Comportamento
Quando chiami `createInvitee()`:
1. Crea l'invitato nel database
2. Chiama `writeToGoogleSheet()` per scrivere su Google Sheets
3. Se la scrittura su Sheets fallisce, l'operazione continua (non blocca la creazione)
4. Viene loggato un warning se la sincronizzazione fallisce

---

**Documentazione aggiornata il**: 30 Ottobre 2025
**Versione**: 2.1.0
