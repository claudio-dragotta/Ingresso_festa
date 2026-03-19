// ── Configurazione ────────────────────────────────────────────────────────────
// URL del backend (cambia se necessario)
const API_BASE = "https://ingresso-festa-api.onrender.com";

// Dominio istituzionale richiesto (non esposto in nessun messaggio visibile)
const ALLOWED_DOMAIN = "alcampus.it";

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

// ── Legge eventId dall'URL ────────────────────────────────────────────────────
// URL atteso: https://sito.com/?e=EVENT_ID  oppure  https://sito.com/EVENT_ID
function getEventId() {
  // Prima prova query string ?e=...
  const params = new URLSearchParams(window.location.search);
  if (params.get("e")) return params.get("e");

  // Poi prova path /EVENT_ID
  const path = window.location.pathname.replace(/^\//, "").split("/")[0];
  if (path && path.length > 4) return path;

  return null;
}

// ── Init ──────────────────────────────────────────────────────────────────────
const eventId = getEventId();

if (!eventId) {
  showState("notfound");
} else {
  fetch(`${API_BASE}/api/register/${eventId}/info`)
    .then((r) => {
      if (!r.ok) throw new Error("not found");
      return r.json();
    })
    .then((event) => {
      $("event-name").textContent = event.name;
      showState("form");
    })
    .catch(() => {
      showState("notfound");
    });
}

// ── Submit ────────────────────────────────────────────────────────────────────
$("reg-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  hideError();

  const firstName = $("firstName").value.trim();
  const lastName  = $("lastName").value.trim();
  const email     = $("email").value.trim();
  const notes     = $("notes").value.trim();

  // Validazioni lato client
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
    const res = await fetch(`${API_BASE}/api/register/${eventId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName, lastName, email, notes: notes || undefined }),
    });

    const data = await res.json();

    if (!res.ok) {
      showError(data.message ?? "Si è verificato un errore. Riprova.");
      btn.disabled = false;
      btn.textContent = "Invia richiesta";
      return;
    }

    // Personalizza messaggio successo
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
