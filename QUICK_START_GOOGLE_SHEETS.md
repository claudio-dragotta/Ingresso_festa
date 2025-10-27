# Quick Start: Google Sheets Integration

Guida rapida in 5 minuti per attivare la sincronizzazione con Google Sheets.

## 🎯 Obiettivo

Collegare il tuo foglio Google Sheets (formato "Cognome Nome" nella colonna A) al sistema Ingresso Festa per importare automaticamente nuove persone e generare i QR code.

---

## ⚡ Setup Rapido (5 minuti)

### 1️⃣ Prepara il Foglio Google (1 min)

1. Vai su [Google Sheets](https://docs.google.com/spreadsheets)
2. Apri o crea il foglio con la lista invitati
3. **Rinomina il primo foglio** in: `Lista`
4. **Colonna A**: inserisci le persone come `Cognome Nome`

Esempio:
```
| A             |
|---------------|
| Rossi Mario   |
| Bianchi Laura |
| De Luca Anna  |
```

5. **Copia l'ID del foglio** dalla URL:
```
https://docs.google.com/spreadsheets/d/1a2B3c4D5e6F7g8H9i0J1k2L3m4N5o6P7q8R9/edit
                                       ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                       Questo è l'ID - copialo!
```

---

### 2️⃣ Configura Google Cloud (3 min)

1. Vai su [Google Cloud Console](https://console.cloud.google.com/)
2. **Crea progetto**: "Ingresso Festa"
3. **Abilita API**: cerca "Google Sheets API" → Abilita
4. **Crea Service Account**:
   - Vai su "API e servizi" > "Credenziali"
   - "Crea credenziali" > "Account di servizio"
   - Nome: `ingresso-festa-sync`
   - Clicca "Crea" (ruolo non necessario)
5. **Scarica JSON**:
   - Clicca sul service account creato
   - Tab "Chiavi" > "Aggiungi chiave" > "Crea nuova chiave"
   - Formato: **JSON** → Scarica
6. **Condividi foglio**:
   - Apri il JSON scaricato
   - Copia l'email che trovi in `"client_email"` (es: `ingresso-festa-sync@...`)
   - Torna al foglio Google
   - Clicca "Condividi" → Incolla email → Permessi: "Visualizzatore"

---

### 3️⃣ Configura il Backend (1 min)

Apri `backend/.env.local` e aggiungi:

```bash
# ID foglio (dal punto 1)
GOOGLE_SHEET_ID=1a2B3c4D5e6F7g8H9i0J1k2L3m4N5o6P7q8R9

# Range (colonna A del foglio "Lista" dalla riga 2)
GOOGLE_SHEET_RANGE=Lista!A2:A

# JSON Service Account (copia TUTTO il contenuto del file scaricato, su UNA RIGA)
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"...TUTTO IL JSON QUI..."}

# Abilita sincronizzazione automatica
GOOGLE_SHEETS_AUTO_SYNC=true

# Sincronizza ogni 10 minuti
GOOGLE_SHEETS_SYNC_INTERVAL=10
```

**IMPORTANTE**: Per `GOOGLE_SERVICE_ACCOUNT_JSON`:
- Apri il file JSON scaricato con un editor di testo
- Seleziona TUTTO (Ctrl+A)
- Copia (Ctrl+C)
- Incolla dopo il `=` (deve stare su UNA SOLA RIGA)

---

### 4️⃣ Avvia e Testa (30 sec)

```bash
cd backend
npm run dev
```

Dovresti vedere nei log:
```
✅ Sincronizzazione completata: 3 nuovi, 0 già presenti, 0 errori
```

Vai sulla dashboard → Troverai una nuova sezione "📊 Sincronizza Google Sheets"

---

## 🎉 Fatto!

Ora puoi:
- **Aggiungere persone al foglio Google** (colonna A: "Cognome Nome")
- **Aspettare max 10 minuti** → sistema sincronizza automaticamente
- **Oppure cliccare "🔄 Sincronizza Ora"** dalla dashboard per import immediato

---

## 📝 Formato Supportato

Il parser riconosce automaticamente:

| Formato nel Foglio | Cognome | Nome |
|-------------------|---------|------|
| `Rossi Mario` | Rossi | Mario |
| `De Luca Anna` | De Luca | Anna |
| `Van Der Berg Jan` | Van Der Berg | Jan |
| `Rossi` | Rossi | *(vuoto)* |

**Regola**: L'ultima parola è il **nome**, tutto il resto è il **cognome**.

---

## 🔧 Troubleshooting Rapido

### Errore: "Impossibile connettersi"
→ Hai condiviso il foglio con l'email del service account?

### Errore: "Google Sheet vuoto"
→ Il foglio si chiama esattamente "Lista"? (case-sensitive)

### Errore: "JSON non valido"
→ Hai copiato tutto il JSON su una sola riga?

---

## 📚 Documentazione Completa

Per la guida dettagliata con screenshot e troubleshooting avanzato:
👉 [GOOGLE_SHEETS_SETUP.md](GOOGLE_SHEETS_SETUP.md)

Per riepilogo tecnico dell'implementazione:
👉 [GOOGLE_SHEETS_INTEGRATION.md](GOOGLE_SHEETS_INTEGRATION.md)

---

**Buona sincronizzazione!** 🚀
