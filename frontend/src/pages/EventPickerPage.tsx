import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { useEvent } from "../context/EventContext";
import type { EventInfo, EventModule } from "../context/EventContext";
import { listEvents, createEvent, deleteEvent, updateEvent, setupEventSheet } from "../api/events";
import "./EventPickerPage.css";

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Attiva",
  PAUSED: "In pausa",
  LOCKED: "Bloccata",
};

const ALL_SHEET_TABS = ["Lista", "GREEN", "Magliette", "Navette Andata", "Navette Ritorno"] as const;
type SheetTab = (typeof ALL_SHEET_TABS)[number];

export default function EventPickerPage() {
  const { isAdmin, logout } = useAuth();
  const { selectEvent } = useEvent();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Stato form creazione
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formModules, setFormModules] = useState<EventModule[]>(["tshirts", "expenses", "shuttles"]);
  const [formSheetId, setFormSheetId] = useState("");

  // Stato modale impostazioni evento
  const [editingEvent, setEditingEvent] = useState<EventInfo | null>(null);
  const [editSheetId, setEditSheetId] = useState("");
  const [selectedTabs, setSelectedTabs] = useState<SheetTab[]>([...ALL_SHEET_TABS]);
  const [setupMsg, setSetupMsg] = useState<string | null>(null);

  const { data: events = [], isLoading } = useQuery<EventInfo[]>({
    queryKey: ["events"],
    queryFn: listEvents,
  });

  const deleteMutation = useMutation({
    mutationFn: (eventId: string) => deleteEvent(eventId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["events"] }),
  });

  const createMutation = useMutation({
    mutationFn: createEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      setShowCreateForm(false);
      setFormName("");
      setFormDate("");
      setFormModules(["tshirts", "expenses", "shuttles"]);
      setFormSheetId("");
    },
  });

  const updateSheetMutation = useMutation({
    mutationFn: ({ eventId, googleSheetId }: { eventId: string; googleSheetId: string | null }) =>
      updateEvent(eventId, { googleSheetId }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      setEditingEvent(updated);
      setSetupMsg("Sheet ID salvato.");
    },
  });

  const setupSheetMutation = useMutation({
    mutationFn: ({ eventId, tabs }: { eventId: string; tabs: SheetTab[] }) =>
      setupEventSheet(eventId, tabs),
    onSuccess: () => setSetupMsg("Tab e intestazioni configurati correttamente nel foglio!"),
    onError: (err: any) =>
      setSetupMsg(`Errore: ${err?.response?.data?.message ?? err.message}`),
  });

  const handleSelectEvent = (event: EventInfo) => {
    queryClient.clear();
    selectEvent(event);
    navigate("/", { replace: true });
  };

  const handleDeleteEvent = (e: React.MouseEvent, eventId: string, eventName: string) => {
    e.stopPropagation();
    if (!window.confirm(`Eliminare la festa "${eventName}"?\nTutti i dati (invitati, spese, navette, magliette) verranno cancellati definitivamente.`)) return;
    deleteMutation.mutate(eventId);
  };

  const handleOpenSettings = (e: React.MouseEvent, event: EventInfo) => {
    e.stopPropagation();
    setEditingEvent(event);
    setEditSheetId(event.googleSheetId ?? "");
    setSetupMsg(null);
    // Pre-seleziona i tab in base ai moduli attivi
    const defaultTabs: SheetTab[] = ["Lista", "GREEN"];
    if (event.modules.includes("tshirts")) defaultTabs.push("Magliette");
    if (event.modules.includes("shuttles")) { defaultTabs.push("Navette Andata"); defaultTabs.push("Navette Ritorno"); }
    setSelectedTabs(defaultTabs);
  };

  const handleTabToggle = (tab: SheetTab) => {
    setSelectedTabs((prev) =>
      prev.includes(tab) ? prev.filter((t) => t !== tab) : [...prev, tab]
    );
  };

  const handleSaveSheetId = () => {
    if (!editingEvent) return;
    updateSheetMutation.mutate({
      eventId: editingEvent.id,
      googleSheetId: editSheetId.trim() || null,
    });
  };

  const handleSetupSheet = () => {
    if (!editingEvent) return;
    setSetupMsg(null);
    setupSheetMutation.mutate({ eventId: editingEvent.id, tabs: selectedTabs });
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
      googleSheetId: formSheetId.trim() || undefined,
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
                <div
                  key={event.id}
                  className="event-card"
                  onClick={() => handleSelectEvent(event)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && handleSelectEvent(event)}
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
                    {event.modules.includes("tshirts") && <span className="module-chip">Magliette</span>}
                    {event.modules.includes("shuttles") && <span className="module-chip">Navette</span>}
                    {event.modules.includes("expenses") && <span className="module-chip">Spese</span>}
                  </div>
                  <div className="event-card-sheet-status">
                    {event.googleSheetId ? (
                      <span className="sheet-linked">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        Sheet collegato
                      </span>
                    ) : (
                      <span className="sheet-missing">Nessun sheet</span>
                    )}
                  </div>
                  <div className="event-card-footer">
                    <div className="event-card-arrow">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 18l6-6-6-6"/>
                      </svg>
                    </div>
                    {isAdmin && (
                      <div className="event-card-actions">
                        <button
                          type="button"
                          className="event-settings-btn"
                          onClick={(e) => handleOpenSettings(e, event)}
                          title="Impostazioni festa"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="3"/>
                            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
                          </svg>
                        </button>
                        <button
                          type="button"
                          className="event-delete-btn"
                          onClick={(e) => handleDeleteEvent(e, event.id, event.name)}
                          disabled={deleteMutation.isPending}
                          title="Elimina festa"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6l-1 14H6L5 6"/>
                            <path d="M10 11v6M14 11v6"/>
                            <path d="M9 6V4h6v2"/>
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
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
                    <label htmlFor="event-sheet-id">Google Sheet ID (opzionale)</label>
                    <input
                      id="event-sheet-id"
                      type="text"
                      value={formSheetId}
                      onChange={(e) => setFormSheetId(e.target.value)}
                      placeholder="Incolla l'ID del foglio Google Sheets"
                    />
                    <span className="form-hint">
                      Crea un foglio su drive.google.com, condividilo con il service account,
                      poi incolla l'ID dall'URL. I tab verranno configurati automaticamente.
                    </span>
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

      {/* Modale impostazioni evento */}
      {editingEvent && (
        <div className="event-settings-overlay" onClick={() => setEditingEvent(null)}>
          <div className="event-settings-modal" onClick={(e) => e.stopPropagation()}>
            <div className="event-settings-header">
              <h2>Impostazioni — {editingEvent.name}</h2>
              <button type="button" className="modal-close-btn" onClick={() => setEditingEvent(null)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div className="event-settings-body">
              <div className="form-field">
                <label htmlFor="edit-sheet-id">Google Sheet ID</label>
                <input
                  id="edit-sheet-id"
                  type="text"
                  value={editSheetId}
                  onChange={(e) => {
                    setEditSheetId(e.target.value);
                    setSetupMsg(null);
                  }}
                  placeholder="Incolla l'ID del foglio Google Sheets"
                />
                <span className="form-hint">
                  Dall'URL: docs.google.com/spreadsheets/d/<strong>ID_QUI</strong>/edit
                </span>
              </div>

              <div className="settings-actions">
                <button
                  type="button"
                  className="submit-button"
                  onClick={handleSaveSheetId}
                  disabled={updateSheetMutation.isPending}
                >
                  {updateSheetMutation.isPending ? "Salvataggio..." : "Salva Sheet ID"}
                </button>
              </div>

              {editingEvent.googleSheetId && (
                <div className="sheet-tabs-section">
                  <label className="sheet-tabs-label">Tab da aggiungere al foglio</label>
                  <div className="sheet-tabs-chips">
                    {ALL_SHEET_TABS.map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        className={`sheet-tab-chip ${selectedTabs.includes(tab) ? "selected" : ""}`}
                        onClick={() => handleTabToggle(tab)}
                      >
                        {selectedTabs.includes(tab) && (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="13" height="13">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        )}
                        {tab}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="setup-sheet-button"
                    onClick={handleSetupSheet}
                    disabled={setupSheetMutation.isPending || selectedTabs.length === 0}
                    title="Aggiunge i tab selezionati al foglio (salta quelli già esistenti)"
                  >
                    {setupSheetMutation.isPending ? "Configurazione..." : "Configura Tab Sheet"}
                  </button>
                  <p className="form-hint">
                    I tab già presenti nel foglio non vengono modificati. La colonna "Tipologia Pagamento" nel tab Lista avrà un menu a tendina (paypal, contanti, p2p, bonifico).
                  </p>
                </div>
              )}

              {setupMsg && (
                <div className={`setup-msg ${setupMsg.startsWith("Errore") ? "form-error" : "form-success"}`}>
                  {setupMsg}
                </div>
              )}

              <div className="settings-info">
                <p><strong>Moduli attivi:</strong> {editingEvent.modules.join(", ") || "nessuno"}</p>
                <p><strong>Sheet collegato:</strong> {editingEvent.googleSheetId ? "Sì" : "No"}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
