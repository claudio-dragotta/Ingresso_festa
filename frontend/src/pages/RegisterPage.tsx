import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { fetchEventInfo, submitPreRegistration } from "../api/preregistrations";
import "./RegisterPage.css";

export default function RegisterPage() {
  const { eventId } = useParams<{ eventId: string }>();

  const [form, setForm] = useState({ firstName: "", lastName: "", email: "" });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: eventInfo, isLoading: loadingEvent, isError: eventError } = useQuery({
    queryKey: ["event-info", eventId],
    queryFn: () => fetchEventInfo(eventId!),
    enabled: !!eventId,
    retry: false,
  });

  const validateForm = (): string | null => {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim())
      return "Compila tutti i campi obbligatori.";

    const parts = form.email.trim().toLowerCase().split("@");
    if (parts.length !== 2 || parts[1] !== "alcampus.it")
      return "Devi utilizzare la tua email istituzionale universitaria per registrarti.";

    return null;
  };

  const mutation = useMutation({
    mutationFn: () =>
      submitPreRegistration(eventId!, {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
      }),
    onSuccess: () => {
      setSubmitted(true);
      setError(null);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? "Si è verificato un errore. Riprova.";
      setError(msg);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const err = validateForm();
    if (err) { setError(err); return; }
    mutation.mutate();
  };

  if (loadingEvent) {
    return (
      <div className="reg-page">
        <div className="reg-card">
          <div className="reg-loading">Caricamento...</div>
        </div>
      </div>
    );
  }

  if (eventError || !eventInfo) {
    return (
      <div className="reg-page">
        <div className="reg-card">
          <div className="reg-error-box">Evento non trovato o link non valido.</div>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="reg-page">
        <div className="reg-card">
          <div className="reg-success">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" strokeLinecap="round"/>
              <polyline points="22 4 12 14.01 9 11.01" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <h2>Registrazione ricevuta!</h2>
            <p>
              Grazie <strong>{form.firstName}</strong>! La tua richiesta è stata inviata.
              Riceverai un'email con il QR code non appena il pagamento sarà confermato.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="reg-page">
      <div className="reg-card">
        <div className="reg-header">
          <div className="reg-event-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.63a19.79 19.79 0 01-3.07-8.64A2 2 0 012 .99h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 8.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
            </svg>
          </div>
          <h1 className="reg-title">{eventInfo.name}</h1>
          <p className="reg-subtitle">Compila il form con la tua email istituzionale per richiedere il biglietto</p>
        </div>

        <form className="reg-form" onSubmit={handleSubmit} noValidate>
          <div className="reg-row">
            <div className="reg-field">
              <label className="reg-label">Nome *</label>
              <input
                className="reg-input"
                type="text"
                placeholder="Es. Mario"
                value={form.firstName}
                onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
                required
                autoComplete="given-name"
              />
            </div>
            <div className="reg-field">
              <label className="reg-label">Cognome *</label>
              <input
                className="reg-input"
                type="text"
                placeholder="Es. Rossi"
                value={form.lastName}
                onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
                required
                autoComplete="family-name"
              />
            </div>
          </div>

          <div className="reg-field">
            <label className="reg-label">Email istituzionale *</label>
            <input
              className="reg-input"
              type="email"
              placeholder="nome.cognome@..."
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              required
              autoComplete="email"
            />
            <span className="reg-hint">
              Usa la tua email istituzionale universitaria — qui riceverai il QR code per l'ingresso
            </span>
          </div>

          {error && <div className="reg-error-box">{error}</div>}

          <button
            type="submit"
            className="reg-submit"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Invio in corso..." : "Invia richiesta"}
          </button>
        </form>
      </div>
    </div>
  );
}
