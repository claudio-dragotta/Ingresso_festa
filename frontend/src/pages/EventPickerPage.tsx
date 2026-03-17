import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { useEvent } from "../context/EventContext";
import type { EventInfo, EventModule } from "../context/EventContext";
import { listEvents, createEvent } from "../api/events";
import "./EventPickerPage.css";

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Attiva",
  PAUSED: "In pausa",
  LOCKED: "Bloccata",
};

export default function EventPickerPage() {
  const { isAdmin, logout } = useAuth();
  const { selectEvent } = useEvent();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formModules, setFormModules] = useState<EventModule[]>(["tshirts", "expenses", "shuttles"]);
  const [formCreateSheet, setFormCreateSheet] = useState(false);

  const { data: events = [], isLoading } = useQuery<EventInfo[]>({
    queryKey: ["events"],
    queryFn: listEvents,
  });

  const createMutation = useMutation({
    mutationFn: createEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      setShowCreateForm(false);
      setFormName("");
      setFormDate("");
      setFormModules(["tshirts", "expenses", "shuttles"]);
      setFormCreateSheet(true);
    },
  });

  const handleSelectEvent = (event: EventInfo) => {
    selectEvent(event);
    navigate("/", { replace: true });
  };

  const handleModuleToggle = (module: EventModule) => {
    setFormModules((prev) =>
      prev.includes(module) ? prev.filter((m) => m !== module) : [...prev, module]
    );
  };

  const handleCreate = (e: FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;
    createMutation.mutate({
      name: formName.trim(),
      date: formDate || undefined,
      modules: formModules,
      createSheet: formCreateSheet,
    });
  };

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="event-picker-page">
      <div className="event-picker-background">
        <div className="gradient-orb orb-1"></div>
        <div className="gradient-orb orb-2"></div>
        <div className="gradient-orb orb-3"></div>
      </div>

      <div className="event-picker-container">
        <div className="event-picker-card">
          <div className="event-picker-header">
            <div className="event-picker-icon" aria-hidden>
              <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
            <h1>Scegli una Festa</h1>
            <p>Seleziona l'evento a cui vuoi accedere</p>
          </div>

          {isLoading ? (
            <div className="event-picker-loading">
              <div className="spinner"></div>
              <p>Caricamento eventi...</p>
            </div>
          ) : events.length === 0 ? (
            <div className="event-picker-empty">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <p>Nessun evento disponibile</p>
            </div>
          ) : (
            <div className="events-grid">
              {events.map((event) => (
                <button
                  key={event.id}
                  className="event-card"
                  onClick={() => handleSelectEvent(event)}
                  type="button"
                >
                  <div className="event-card-top">
                    <h2 className="event-card-name">{event.name}</h2>
                    <span className={`event-status-badge status-${event.status.toLowerCase()}`}>
                      {STATUS_LABELS[event.status] ?? event.status}
                    </span>
                  </div>
                  {event.date && (
                    <p className="event-card-date">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                        <line x1="16" y1="2" x2="16" y2="6"/>
                        <line x1="8" y1="2" x2="8" y2="6"/>
                        <line x1="3" y1="10" x2="21" y2="10"/>
                      </svg>
                      {new Date(event.date).toLocaleDateString("it-IT", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  )}
                  <div className="event-card-modules">
                    {event.modules.includes("tshirts") && (
                      <span className="module-chip">Magliette</span>
                    )}
                    {event.modules.includes("shuttles") && (
                      <span className="module-chip">Navette</span>
                    )}
                    {event.modules.includes("expenses") && (
                      <span className="module-chip">Spese</span>
                    )}
                  </div>
                  <div className="event-card-arrow">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 18l6-6-6-6"/>
                    </svg>
                  </div>
                </button>
              ))}
            </div>
          )}

          {isAdmin && (
            <div className="event-picker-actions">
              {!showCreateForm ? (
                <button
                  type="button"
                  className="create-event-button"
                  onClick={() => setShowCreateForm(true)}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 5v14m-7-7h14"/>
                  </svg>
                  Crea nuova festa
                </button>
              ) : (
                <form className="create-event-form" onSubmit={handleCreate}>
                  <h3>Nuova Festa</h3>

                  <div className="form-field">
                    <label htmlFor="event-name">Nome evento *</label>
                    <input
                      id="event-name"
                      type="text"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="Es. Festa di Capodanno"
                      required
                      autoFocus
                    />
                  </div>

                  <div className="form-field">
                    <label htmlFor="event-date">Data (opzionale)</label>
                    <input
                      id="event-date"
                      type="date"
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                    />
                  </div>

                  <div className="form-field">
                    <label>Moduli attivi</label>
                    <div className="module-checkboxes">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={formModules.includes("shuttles")}
                          onChange={() => handleModuleToggle("shuttles")}
                        />
                        <span>Navette</span>
                      </label>
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={formModules.includes("tshirts")}
                          onChange={() => handleModuleToggle("tshirts")}
                        />
                        <span>Magliette</span>
                      </label>
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={formModules.includes("expenses")}
                          onChange={() => handleModuleToggle("expenses")}
                        />
                        <span>Spese</span>
                      </label>
                    </div>
                  </div>

                  <div className="form-field">
                    <label className="toggle-label">
                      <span>Crea foglio Google Sheets automaticamente</span>
                      <div
                        className={`toggle-switch ${formCreateSheet ? "on" : "off"}`}
                        onClick={() => setFormCreateSheet((v) => !v)}
                        role="switch"
                        aria-checked={formCreateSheet}
                        tabIndex={0}
                        onKeyDown={(e) => e.key === "Enter" && setFormCreateSheet((v) => !v)}
                      >
                        <div className="toggle-thumb"></div>
                      </div>
                    </label>
                  </div>

                  {createMutation.isError && (
                    <div className="form-error">
                      {(createMutation.error as any)?.response?.data?.message
                        ?? (createMutation.error as any)?.message
                        ?? "Errore durante la creazione dell'evento. Riprova."}
                    </div>
                  )}

                  <div className="form-actions">
                    <button
                      type="button"
                      className="cancel-button"
                      onClick={() => setShowCreateForm(false)}
                    >
                      Annulla
                    </button>
                    <button
                      type="submit"
                      className="submit-button"
                      disabled={createMutation.isPending}
                    >
                      {createMutation.isPending ? "Creazione..." : "Crea Festa"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          <div className="event-picker-footer">
            <button type="button" className="logout-link" onClick={handleLogout}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              Esci
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
