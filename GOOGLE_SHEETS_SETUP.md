# Guida Configurazione Google Sheets Integration

Questa guida ti spiega passo-passo come configurare la sincronizzazione automatica tra il tuo foglio Google Sheets e il sistema Ingresso Festa.

## Prerequisiti

- Un account Google
- Un foglio Google Sheets con la lista degli invitati
- Accesso alla Google Cloud Console

---

## Parte 1: Prepara il Foglio Google Sheets

### 1. Crea o apri il tuo foglio Google Sheets

Vai su [Google Sheets](https://docs.google.com/spreadsheets) e:

1. **Crea un nuovo foglio** oppure apri quello esistente
2. **Rinomina il primo foglio in "Lista"** (importante!)
3. **Nella colonna A**, inserisci le persone nel formato: **Cognome Nome**

Esempio:

| A (Colonna A) |
|---------------|
| Rossi Mario   |
| Bianchi Laura |
| Verdi Giuseppe|
| De Luca Anna  |

**Note importanti:**
- La prima riga (riga 1) può contenere un'intestazione (es: "Nome Completo") - verrà ignorata
- Il sistema leggerà dalla riga 2 in poi
- Formato richiesto: `Cognome Nome` (con uno spazio in mezzo)
- Cognomi composti funzionano: `De Luca Anna`, `Van Der Berg Jan`

### 2. Copia l'ID del foglio

Dalla URL del foglio, copia la parte evidenziata:

```
https://docs.google.com/spreadsheets/d/[QUESTO_È_L_ID_DEL_FOGLIO]/edit
                                       ^^^^^^^^^^^^^^^^^^^^^^^
                                       Copia questa parte
```

Esempio:
```
https://docs.google.com/spreadsheets/d/1a2B3c4D5e6F7g8H9i0J1k2L3m4N5o6P7q8R9/edit
                                       ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                       ID: 1a2B3c4D5e6F7g8H9i0J1k2L3m4N5o6P7q8R9
```

Salvalo da qualche parte, ti servirà dopo.

---

## Parte 2: Configura Google Cloud Service Account

### Step 1: Crea un Progetto Google Cloud

1. Vai su [Google Cloud Console](https://console.cloud.google.com/)
2. Clicca su "Seleziona un progetto" in alto
3. Clicca su "Nuovo Progetto"
4. Nome progetto: `Ingresso Festa` (o quello che preferisci)
5. Clicca "Crea"

### Step 2: Abilita l'API Google Sheets

1. Nel menu a sinistra, vai su **"API e servizi" > "Libreria"**
2. Cerca "**Google Sheets API**"
3. Clicca sul risultato "Google Sheets API"
4. Clicca **"Abilita"**

### Step 3: Crea un Service Account

1. Nel menu a sinistra, vai su **"API e servizi" > "Credenziali"**
2. Clicca **"Crea credenziali"** in alto
3. Seleziona **"Account di servizio"**
4. Compila i campi:
   - **Nome account di servizio**: `ingresso-festa-sync`
   - **Descrizione**: `Service account per sincronizzazione Google Sheets`
5. Clicca **"Crea e continua"**
6. Alla voce "Ruolo" puoi lasciare vuoto (non è necessario per questo caso)
7. Clicca **"Continua"** e poi **"Fine"**

### Step 4: Crea una Chiave JSON

1. Troverai il service account appena creato nella lista "Account di servizio"
2. Clicca sul **nome del service account** (es: `ingresso-festa-sync@...`)
3. Vai alla tab **"Chiavi"**
4. Clicca **"Aggiungi chiave" > "Crea nuova chiave"**
5. Seleziona formato **JSON**
6. Clicca **"Crea"**

**Un file JSON verrà scaricato automaticamente sul tuo computer.**

Il file avrà un nome tipo: `ingresso-festa-abc123-xyz789.json`

### Step 5: Condividi il Foglio con il Service Account

1. **Apri il file JSON** scaricato con un editor di testo
2. Cerca la riga `"client_email"`, troverai un indirizzo tipo:
   ```
   ingresso-festa-sync@ingresso-festa-123456.iam.gserviceaccount.com
   ```
3. **Copia questo indirizzo email**
4. Torna al tuo **foglio Google Sheets**
5. Clicca sul pulsante **"Condividi"** in alto a destra
6. **Incolla l'indirizzo email del service account**
7. Imposta permessi: **"Visualizzatore"** (read-only è sufficiente)
8. Clicca **"Invia"**

---

## Parte 3: Configura le Variabili d'Ambiente

### Backend - File `.env.local`

Crea o modifica il file `backend/.env.local` e aggiungi:

```bash
# Google Sheets Integration
GOOGLE_SHEET_ID=1a2B3c4D5e6F7g8H9i0J1k2L3m4N5o6P7q8R9
GOOGLE_SHEET_RANGE=Lista!A2:A
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"ingresso-festa-123456",...}
GOOGLE_SHEETS_AUTO_SYNC=true
GOOGLE_SHEETS_SYNC_INTERVAL=10
```

**Come compilare:**

1. **GOOGLE_SHEET_ID**: Incolla l'ID del foglio che hai copiato nel Parte 1, Step 2
2. **GOOGLE_SHEET_RANGE**: Lascia `Lista!A2:A` (legge colonna A dal foglio "Lista" dalla riga 2 in poi)
3. **GOOGLE_SERVICE_ACCOUNT_JSON**:
   - Apri il file JSON scaricato
   - **Copia TUTTO il contenuto** del file (deve iniziare con `{"type":"service_account"...`)
   - **Incolla tutto in una sola riga** (rimuovi gli a capo)
   - Esempio:
     ```
     GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"ingresso-festa-123456","private_key_id":"abc123...","private_key":"-----BEGIN PRIVATE KEY-----\nMIIE...xyz\n-----END PRIVATE KEY-----\n","client_email":"ingresso-festa-sync@...","client_id":"123456","auth_uri":"https://...","token_uri":"https://..."}
     ```
4. **GOOGLE_SHEETS_AUTO_SYNC**: Imposta `true` per abilitare la sincronizzazione automatica
5. **GOOGLE_SHEETS_SYNC_INTERVAL**: Intervallo in minuti (default: 10 = sincronizza ogni 10 minuti)

**IMPORTANTE per Windows:**
Se usi Windows e hai problemi con i caratteri speciali nel JSON (come `\n` nella chiave privata), puoi usare **virgolette doppie escapate**:

```bash
GOOGLE_SERVICE_ACCOUNT_JSON="{\"type\":\"service_account\",\"project_id\":\"ingresso-festa-123456\",...}"
```

Oppure, ancora meglio, usa un file `.env.local` invece di variabili shell.

---

## Parte 4: Configurazione per Render (Produzione)

Quando fai il deploy su Render:

### Backend Service - Environment Variables

Nel pannello Render del tuo backend service, aggiungi queste variabili:

| Nome | Valore |
|------|--------|
| `GOOGLE_SHEET_ID` | `1a2B3c4D5e6F7g8H9i0J1k2L3m4N5o6P7q8R9` |
| `GOOGLE_SHEET_RANGE` | `Lista!A2:A` |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | *Copia tutto il contenuto del file JSON in una riga* |
| `GOOGLE_SHEETS_AUTO_SYNC` | `true` |
| `GOOGLE_SHEETS_SYNC_INTERVAL` | `10` |

**Tip**: Per `GOOGLE_SERVICE_ACCOUNT_JSON`, copia il JSON come **plain text** (senza escape) - Render gestirà automaticamente i caratteri speciali.

---

## Test della Configurazione

### 1. Avvia il Backend

```bash
cd backend
npm run dev
```

Dovresti vedere nei log:

```
Server avviato su http://0.0.0.0:8000
Google Sheets auto-sync abilitato
🚀 Avvio auto-sync Google Sheets ogni 10 minuti
📋 Trovate 4 persone nel foglio Google
✅ Importato: Rossi Mario
✅ Importato: Bianchi Laura
...
✅ Sincronizzazione completata: 4 nuovi, 0 già presenti, 0 errori
```

### 2. Test dalla Dashboard

1. Fai login nella dashboard
2. Troverai una nuova sezione **"📊 Sincronizza Google Sheets"**
3. Clicca sul bottone **"🔄 Sincronizza Ora"**
4. Dovresti vedere un popup con il risultato:

```
✅ Sincronizzazione completata: 2 nuovi importati, 2 già presenti

Nuovi: 2
Già presenti: 2
Totale dal foglio: 4
```

### 3. Test API (opzionale)

Puoi testare l'endpoint direttamente:

```bash
curl -X POST http://localhost:8000/api/sync/google-sheets \
  -H "Authorization: Bearer TUO_JWT_TOKEN"
```

---

## Come Funziona

### Sincronizzazione Automatica

Quando `GOOGLE_SHEETS_AUTO_SYNC=true`:

1. **All'avvio del server**: prima sincronizzazione immediata
2. **Ogni X minuti** (configurato in `GOOGLE_SHEETS_SYNC_INTERVAL`): sincronizzazione automatica
3. **Controllo duplicati**: persone già presenti vengono saltate (confronto case-insensitive su nome+cognome)
4. **Generazione QR**: per ogni nuova persona viene automaticamente generato il QR code

### Sincronizzazione Manuale

Dalla dashboard, clicca sul bottone **"🔄 Sincronizza Ora"** quando:
- Hai aggiunto nuove persone al foglio e vuoi importarle subito
- Vuoi forzare una sincronizzazione fuori dal ciclo automatico

---

## Formato Dati

### Colonna A - Formato "Cognome Nome"

Il parser è intelligente e gestisce:

| Input Colonna A | Cognome Rilevato | Nome Rilevato |
|-----------------|------------------|---------------|
| `Rossi Mario` | Rossi | Mario |
| `De Luca Anna` | De Luca | Anna |
| `Van Der Berg Jan` | Van Der Berg | Jan |
| `Rossi` | Rossi | *(vuoto)* |
| `Bianchi Maria Luisa` | Bianchi Maria | Luisa |

**Strategia di parsing:**
- L'**ultima parola** è considerata il **nome**
- **Tutto il resto** è considerato il **cognome**

Quindi:
- ✅ `Rossi Mario` → Cognome: "Rossi", Nome: "Mario"
- ✅ `De Luca Anna` → Cognome: "De Luca", Nome: "Anna"
- ✅ `Bianchi Maria Luisa` → Cognome: "Bianchi Maria", Nome: "Luisa"

Se il tuo formato è **Nome Cognome**, puoi modificare `GOOGLE_SHEET_RANGE` per leggere da colonne separate, oppure invertire il formato nel foglio.

---

## Risoluzione Problemi

### Errore: "GOOGLE_SERVICE_ACCOUNT_JSON non configurato"

- Verifica di aver impostato la variabile `GOOGLE_SERVICE_ACCOUNT_JSON`
- Il JSON deve essere valido (usa un validator online se non sei sicuro)

### Errore: "Impossibile connettersi a Google Sheets"

- Verifica che l'API Google Sheets sia abilitata nel progetto Google Cloud
- Controlla che il foglio sia condiviso con l'email del service account
- Verifica che `GOOGLE_SHEET_ID` sia corretto

### Errore: "Google Sheet vuoto o nessun dato"

- Controlla che il foglio si chiami esattamente **"Lista"** (case-sensitive)
- Verifica che ci siano dati nella colonna A dalla riga 2 in poi
- Prova a cambiare `GOOGLE_SHEET_RANGE` (es: `Lista!A1:A` per iniziare dalla riga 1)

### Le persone vengono importate più volte

- Questo non dovrebbe succedere: il sistema controlla i duplicati
- Se succede, verifica i log per errori
- Possibile causa: nomi con caratteri speciali o spazi multipli

### Il formato "Cognome Nome" non viene riconosciuto correttamente

- Verifica che ci sia esattamente **uno spazio** tra cognome e nome
- Rimuovi spazi multipli o caratteri nascosti (copia-incolla da altre fonti può causare problemi)
- Se necessario, modifica il parser in `backend/src/services/googleSheetsService.ts`

### Sincronizzazione automatica non parte

- Verifica che `GOOGLE_SHEETS_AUTO_SYNC=true` (non `True` o `TRUE`)
- Controlla i log all'avvio del server per eventuali errori
- Usa l'endpoint `GET /api/sync/status` per verificare lo stato

---

## Sicurezza

⚠️ **IMPORTANTE:**

1. **NON committare mai il file JSON delle credenziali su Git**
   - È già escluso da `.gitignore`
   - Contiene chiavi private sensibili

2. **NON condividere il contenuto di `GOOGLE_SERVICE_ACCOUNT_JSON`**
   - Trattalo come una password

3. **Usa permessi minimi per il service account**
   - Read-only sul foglio Google è sufficiente
   - Non dare ruoli amministrativi nel progetto Google Cloud

4. **Su Render**, usa le **Environment Variables** del pannello (non hard-code nel codice)

---

## Flusso Completo di Lavoro

1. **Aggiungi persone al foglio Google** (colonna A, formato "Cognome Nome")
2. **Aspetta la sincronizzazione automatica** (massimo 10 minuti) **OPPURE** clicca "Sincronizza Ora" dalla dashboard
3. Il sistema:
   - Legge il foglio
   - Importa nuove persone
   - Genera QR code automaticamente
   - Salta i duplicati
4. **Scarica o invia i QR** dalla dashboard
5. **Il giorno della festa**: usa la pagina scanner per verificare gli ingressi

---

## Contatti e Supporto

Per problemi o domande:
- Consulta i log del backend (`backend/logs/` o console)
- Verifica la configurazione con `GET /api/sync/test-connection`
- Controlla il [README.md](README.md) principale per documentazione generale

---

## Riepilogo Configurazione Rapida

```bash
# 1. Copia ID foglio Google da URL
GOOGLE_SHEET_ID=...

# 2. Crea Service Account su Google Cloud Console
# 3. Abilita Google Sheets API
# 4. Scarica JSON credenziali
# 5. Condividi foglio con email service account

# 6. Configura backend/.env.local
GOOGLE_SHEET_ID=TUO_ID_FOGLIO
GOOGLE_SHEET_RANGE=Lista!A2:A
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
GOOGLE_SHEETS_AUTO_SYNC=true
GOOGLE_SHEETS_SYNC_INTERVAL=10

# 7. Avvia backend
cd backend
npm run dev

# 8. Verifica nella dashboard
# Clicca "Sincronizza Ora" e controlla il risultato
```

Buona sincronizzazione! 🚀
