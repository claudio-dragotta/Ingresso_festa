// ── Configurazione ────────────────────────────────────────────────────────────
const API_BASE = "https://ingresso-festa-api.onrender.com";
const EVENT_ID = "cmmupsg340000oc1zrj9f6hmq";
const ALLOWED_DOMAIN = "alcampus.it"; // non esposto nei messaggi visibili

// ── Helpers ───────────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

function showState(name) {
  ["loading", "notfound", "form", "success"].forEach((s) => {
    $("state-" + s).classList.toggle("hidden", s !== name);
  });
}

function isInstitutionalEmail(email) {
  const parts = email.trim().toLowerCase().split("@");
  return parts.length === 2 && parts[1] === ALLOWED_DOMAIN;
}

function showError(msg) {
  const box = $("form-error");
  box.textContent = msg;
  box.classList.remove("hidden");
}

function hideError() {
  $("form-error").classList.add("hidden");
}

// ── Carica nome evento ────────────────────────────────────────────────────────
fetch(`${API_BASE}/api/register/${EVENT_ID}/info`)
  .then((r) => {
    if (!r.ok) throw new Error();
    return r.json();
  })
  .then((event) => {
    $("event-name").textContent = event.name;
    showState("form");
  })
  .catch(() => {
    showState("notfound");
  });

// ── Submit ────────────────────────────────────────────────────────────────────
$("reg-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  hideError();

  const firstName = $("firstName").value.trim();
  const lastName  = $("lastName").value.trim();
  const email     = $("email").value.trim();

  if (!firstName || !lastName || !email) {
    showError("Compila tutti i campi obbligatori.");
    return;
  }
  if (!isInstitutionalEmail(email)) {
    showError("Devi utilizzare la tua email istituzionale universitaria per registrarti.");
    return;
  }

  const btn = $("submit-btn");
  btn.disabled = true;
  btn.textContent = "Invio in corso...";

  try {
    const res = await fetch(`${API_BASE}/api/register/${EVENT_ID}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName, lastName, email }),
    });

    const data = await res.json();

    if (!res.ok) {
      showError(data.message ?? "Si è verificato un errore. Riprova.");
      btn.disabled = false;
      btn.textContent = "Invia richiesta";
      return;
    }

    $("success-msg").textContent =
      `Grazie ${firstName}! La tua richiesta è stata ricevuta. ` +
      `Riceverai il QR code per l'ingresso all'indirizzo ${email} non appena il pagamento sarà confermato.`;

    showState("success");
  } catch {
    showError("Errore di connessione. Controlla la tua rete e riprova.");
    btn.disabled = false;
    btn.textContent = "Invia richiesta";
  }
});
