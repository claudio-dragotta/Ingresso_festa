import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import type { Invitee, InviteeInput, ListType } from "../api/invitees";
import {
  fetchInvitees,
  createInvitee,
  checkInPerson,
  syncGoogleSheets,
  fetchDuplicateInvitees,
  promoteDuplicateGroup,
  keepOneDuplicate,
  resetAndReimport,
  fetchStats,
  type Stats,
  type DuplicateGroup,
} from "../api/invitees";
import "./AdminDashboard.css";

export default function AdminDashboard() {
  const { role } = useAuth();
  const isOrganizer = role === 'ORGANIZER';

  const duplicatesRef = useRef<HTMLDivElement | null>(null);
  const hasShownDupHintRef = useRef(false);
  const [showDupHint, setShowDupHint] = useState(false);

  const [activeTab, setActiveTab] = useState<"paganti" | "green">("paganti");
  const [showAddForm, setShowAddForm] = useState(false);
  const firstNameInputRef = useRef<HTMLInputElement | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [formData, setFormData] = useState<InviteeInput>({
    firstName: "",
    lastName: "",
    listType: "PAGANTE",
    paymentType: "",
  });
  const [sortBy, setSortBy] = useState<"firstName" | "lastName" | "paymentType">("lastName");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const queryClient = useQueryClient();

  // Fetch invitees
  const { data: invitees = [], isLoading } = useQuery<Invitee[]>({
    queryKey: ["invitees"],
    queryFn: fetchInvitees,
  });

  // Stats per contatore affidabile (evita discrepanze client)
  const { data: stats } = useQuery<Stats>({
    queryKey: ["stats"],
    queryFn: fetchStats,
    refetchInterval: 5000,
  });

  // Duplicati
  const { data: duplicates = [] } = useQuery<DuplicateGroup[]>({
    queryKey: ["invitees", "duplicates"],
    queryFn: fetchDuplicateInvitees,
    refetchInterval: 10000,
  });

  // Filtra per tipo
  const pagantiList = invitees.filter((inv) => inv.listType === "PAGANTE");
  const greenList = invitees.filter((inv) => inv.listType === "GREEN");

  const currentList = activeTab === "paganti" ? pagantiList : greenList;

  const toggleSort = (key: typeof sortBy) => {
    if (sortBy === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(key);
      setSortDir("asc");
    }
  };

  // Filtra in base alla ricerca
  const filteredList = currentList.filter((inv) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      inv.firstName.toLowerCase().includes(query) ||
      inv.lastName.toLowerCase().includes(query) ||
      (inv.paymentType && inv.paymentType.toLowerCase().includes(query))
    );
  });

  const sortedCurrent = [...filteredList].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    const aVal = ((a as any)[sortBy] ?? "").toString();
    const bVal = ((b as any)[sortBy] ?? "").toString();
    return aVal.localeCompare(bVal, "it", { sensitivity: "base", numeric: true }) * dir;
  });

  // Se si passa alla tab GREEN e si stava ordinando per pagamento, torna a cognome
  useEffect(() => {
    if (activeTab === "green" && sortBy === "paymentType") {
      setSortBy("lastName");
      setSortDir("asc");
    }
  }, [activeTab]);

  // Mutation per creare invitato
  const createMutation = useMutation({
    mutationFn: createInvitee,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invitees"] });
      setFormData({
        firstName: "",
        lastName: "",
        listType: activeTab === "paganti" ? "PAGANTE" : "GREEN",
        paymentType: "",
      });
      // Metti il focus su "Nome" per inserimenti consecutivi
      setTimeout(() => {
        firstNameInputRef.current?.focus();
      }, 0);
    },
  });

  // Quando apro il form, metti il focus su "Nome"
  useEffect(() => {
    if (showAddForm) {
      setTimeout(() => {
        firstNameInputRef.current?.focus();
      }, 0);
    }
  }, [showAddForm]);

  // Mostra un avviso quando ci sono duplicati all'apertura o dopo sync
  useEffect(() => {
    if (!hasShownDupHintRef.current && duplicates.length > 0) {
      hasShownDupHintRef.current = true;
      setShowDupHint(true);
      setTimeout(() => setShowDupHint(false), 6000);
    }
  }, [duplicates.length]);

  // Mostra l'hint anche immediatamente dopo una sincronizzazione completata
  // (dichiarato nuovamente dopo la definizione di syncMutation per evitare ordine di riferimento)

  const scrollToDuplicates = () => {
    const el = duplicatesRef.current;
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      el.classList.add('dup-highlight');
      setTimeout(() => el.classList.remove('dup-highlight'), 1500);
    }
  };

  // (rimosso) eliminazione singolo invitato dalla tabella

  // Mutation per check-in
  const checkInMutation = useMutation({
    mutationFn: ({ id, adminOverride }: { id: string; adminOverride: boolean }) =>
      checkInPerson(id, adminOverride),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invitees"] });
    },
  });

  // Mutation per sync Google Sheets
  const syncMutation = useMutation({
    mutationFn: (opts?: { pruneMissing?: boolean }) => syncGoogleSheets(opts),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invitees"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["invitees", "duplicates"] });
    },
  });

  const resetMutation = useMutation({
    mutationFn: resetAndReimport,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invitees"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["invitees", "duplicates"] });
    },
  });

  // Mostra hint duplicati quando una sync termina e risultano duplicati
  useEffect(() => {
    if (syncMutation.data && duplicates.length > 0) {
      setShowDupHint(true);
      setTimeout(() => setShowDupHint(false), 6000);
    }
  }, [syncMutation.data, duplicates.length]);

  // Duplicates actions
  const promoteMut = useMutation({
    mutationFn: (key: string) => promoteDuplicateGroup(key),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invitees", "duplicates"] });
      queryClient.invalidateQueries({ queryKey: ["invitees"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
  });
  const keepOneMut = useMutation({
    mutationFn: ({ key, keepId }: { key: string; keepId: string }) => keepOneDuplicate(key, keepId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invitees", "duplicates"] });
      queryClient.invalidateQueries({ queryKey: ["invitees"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
  });

  // Funzione per capitalizzare la prima lettera di ogni parola
  const capitalizeWords = (str: string): string => {
    return str
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const dataToSubmit = {
      ...formData,
      firstName: capitalizeWords(formData.firstName.trim()),
      lastName: capitalizeWords(formData.lastName.trim()),
      listType: activeTab === "paganti" ? ("PAGANTE" as ListType) : ("GREEN" as ListType),
      paymentType: activeTab === "paganti" ? formData.paymentType : undefined,
    };
    createMutation.mutate(dataToSubmit);
  };

  const handleSync = (pruneMissing = false) => {
    syncMutation.mutate(pruneMissing ? { pruneMissing: true } : undefined);
  };

  const handleCheckIn = (person: Invitee) => {
    checkInMutation.mutate({ id: person.id, adminOverride: true });
  };

  // (rimosso) azione elimina per riga

  return (
    <div className="admin-dashboard">
      {/* Duplicati solo per admin */}
      {!isOrganizer && duplicates.length > 0 && (
        <div className="duplicates-alert" ref={duplicatesRef}>
          <svg viewBox="0 0 24 24" fill="currentColor" className="dup-icon">
            <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
          </svg>
          <div className="dup-content">
            <strong>Trovati duplicati</strong>
            <div className="dup-list">
              {duplicates.map((g) => (
                <div key={g.key} className="dup-group">
                  <span className="dup-title">{g.items[0]?.lastName} {g.items[0]?.firstName}</span>
                  <span className="dup-count">×{g.count}</span>
                  <button
                    type="button"
                    className="add-button"
                    onClick={() => promoteMut.mutate(g.key)}
                    disabled={promoteMut.isPending}
                  >
                    Promuovi tutti a PAGANTE
                  </button>
                  <div className="dup-items">
                    {g.items.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className="cancel-button"
                        title="Tieni questo, elimina gli altri"
                        onClick={() => keepOneMut.mutate({ key: g.key, keepId: p.id })}
                        disabled={keepOneMut.isPending}
                      >
                        Conserva {p.listType}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {/* Hint che appare quando ci sono duplicati dopo refresh/sync */}
      {!isOrganizer && showDupHint && duplicates.length > 0 && (
        <div className="dup-hint" role="status">
          <div className="dup-hint-left">
            <svg viewBox="0 0 24 24" fill="currentColor" className="dup-hint-icon">
              <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
            </svg>
            <div>
              <strong>{duplicates.length} gruppi di duplicati rilevati</strong>
              <div className="dup-hint-sub">Clicca per rivederli ora</div>
            </div>
          </div>
          <button type="button" className="add-button" onClick={scrollToDuplicates}>
            Vai ai duplicati
          </button>
        </div>
      )}
      {!isOrganizer && duplicates.length > 0 && (
        <div className="duplicates-alert">
          <svg viewBox="0 0 24 24" fill="currentColor" className="dup-icon">
            <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
          </svg>
          <div className="dup-content">
            <strong>Trovati duplicati</strong>
            <div className="dup-list">
              {duplicates.map((g) => (
                <div key={g.key} className="dup-group">
                  <span className="dup-title">{g.items[0]?.lastName} {g.items[0]?.firstName}</span>
                  <span className="dup-count">×{g.count}</span>
                  <div className="dup-items">
                    {g.items.map((p) => (
                      <span key={p.id} className="dup-badge">{p.listType}{p.paymentType ? ` • ${p.paymentType}` : ""}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {/* Header - sync buttons solo per admin */}
      {!isOrganizer && (
        <div className="dashboard-header">
          <button
          className="sync-button"
          onClick={() => handleSync(false)}
          disabled={syncMutation.isPending}
        >
          {syncMutation.isPending ? (
            <>
              <div className="spinner-small"></div>
              Sincronizzazione...
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0118.8-4.3M22 12.5a10 10 0 01-18.8 4.2"/>
              </svg>
              Sincronizza Google Sheets
            </>
          )}
        </button>
        <button
          className="sync-button"
          onClick={() => {
            if (confirm('Allineare al foglio eliminando chi non è più presente?')) {
              handleSync(true);
            }
          }}
          disabled={syncMutation.isPending}
          title="Sincronizza e rimuovi mancanti"
        >
          Allinea (rimuovi mancanti)
        </button>
        <button
          className="reset-button"
          onClick={() => {
            if (confirm('Confermi il reset degli invitati e il reimport da Google Sheets?')) {
              resetMutation.mutate();
            }
          }}
          disabled={resetMutation.isPending}
        >
          {resetMutation.isPending ? (
            <>
              <div className="spinner-small"></div>
              Reset/Reimport...
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6"/>
              </svg>
              Reset + Reimport
            </>
          )}
        </button>
        </div>
      )}

      {/* Sync Result */}
      {syncMutation.data && (
        <div className={`sync-result ${syncMutation.data.success ? "success" : "error"}`}>
          <svg viewBox="0 0 24 24" fill="currentColor">
            {syncMutation.data.success ? (
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
            ) : (
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
            )}
          </svg>
          <div>
            <strong>
              {syncMutation.data.success ? "Sincronizzazione completata!" : "Errore sincronizzazione"}
            </strong>
            <p>
              {syncMutation.data.newImported} nuovi importati, {syncMutation.data.alreadyExists} già presenti
              {syncMutation.data.breakdown && (
                <> ({syncMutation.data.breakdown.paganti.imported} paganti, {syncMutation.data.breakdown.green.imported} green)</>
              )}
            </p>
          </div>
        </div>
      )}
      {resetMutation.data && (
        <div className="sync-result success">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
          </svg>
          <div>
            <strong>Reset + Reimport completato!</strong>
            <p>
              Eliminati: {resetMutation.data.reset.deletedInvitees} invitati, {resetMutation.data.reset.deletedLogs} log. Importati: {resetMutation.data.import.newImported} nuovi ({resetMutation.data.import.breakdown.paganti.imported} paganti, {resetMutation.data.import.breakdown.green.imported} green), {resetMutation.data.import.alreadyExists} già presenti.
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="tabs">
        <button
          className={`tab ${activeTab === "paganti" ? "active" : ""}`}
          onClick={() => setActiveTab("paganti")}
        >
          <span className="tab-icon" aria-hidden>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="4" width="20" height="16" rx="2"/>
              <line x1="2" y1="8" x2="22" y2="8"/>
              <circle cx="8" cy="14" r="2"/>
              <path d="M20 14h-6"/>
            </svg>
          </span>
          Paganti ({pagantiList.length})
        </button>
        <button
          className={`tab ${activeTab === "green" ? "active" : ""}`}
          onClick={() => setActiveTab("green")}
        >
          <span className="tab-icon" aria-hidden>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10a8 8 0 10-16 0c0 6 8 10 8 10z"/>
              <path d="M12 12a4 4 0 110-8 4 4 0 010 8z"/>
            </svg>
          </span>
          Green ({greenList.length})
        </button>
      </div>

      {/* Add Button - admin sempre, organizer solo su GREEN */}
      {(!isOrganizer || (isOrganizer && activeTab === "green")) && (
        <div className="actions-bar">
          <button className="add-button" onClick={() => setShowAddForm(!showAddForm)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14m-7-7h14"/>
          </svg>
          Aggiungi {activeTab === "paganti" ? (isOrganizer ? "" : "Pagante") : "Green"}
        </button>

          <div className="list-stats">
            {activeTab === "paganti"
              ? (
                <>Entrati: {stats?.paganti.entered ?? 0} / {stats?.paganti.total ?? pagantiList.length}</>
              ) : (
                <>Entrati: {stats?.green.entered ?? 0} / {stats?.green.total ?? greenList.length}</>
              )}
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="search-container">
        <div className="search-box">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="search-icon">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            type="text"
            placeholder="Cerca per nome, cognome o metodo pagamento..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          {searchQuery && (
            <button
              className="clear-search"
              onClick={() => setSearchQuery("")}
              aria-label="Cancella ricerca"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Add Form - admin sempre, organizer solo su GREEN */}
      {showAddForm && (!isOrganizer || (isOrganizer && activeTab === "green")) && (
        <div className="add-form-container">
          <form className="add-form" onSubmit={handleSubmit} autoComplete="off">
            <h3>
              Aggiungi {activeTab === "paganti" ? (isOrganizer ? "" : "Pagante") : "Green"}
            </h3>

            <div className="form-row">
              <div className="form-field">
                <label>Nome *</label>
                <input
                  type="text"
                  ref={firstNameInputRef}
                  value={formData.firstName}
                  onChange={(e) => {
                    const value = e.target.value;
                    // Capitalizza automaticamente mentre si scrive
                    const capitalized = value
                      .split(' ')
                      .map(word => word ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : '')
                      .join(' ');
                    setFormData(prev => ({ ...prev, firstName: capitalized }));
                  }}
                  required
                />
              </div>

              <div className="form-field">
                <label>Cognome *</label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => {
                    const value = e.target.value;
                    // Capitalizza automaticamente mentre si scrive
                    const capitalized = value
                      .split(' ')
                      .map(word => word ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : '')
                      .join(' ');
                    setFormData(prev => ({ ...prev, lastName: capitalized }));
                  }}
                  required
                />
              </div>
            </div>

            {activeTab === "paganti" && (
              <div className="form-field">
                <label>Tipologia Pagamento</label>
                <select
                  value={formData.paymentType}
                  onChange={(e) => setFormData(prev => ({ ...prev, paymentType: e.target.value }))}
                >
                  <option value="">Seleziona...</option>
                  <option value="bonifico">Bonifico</option>
                  <option value="paypal">PayPal</option>
                  <option value="contanti">Contanti</option>
                  <option value="p2p">P2P</option>
                </select>
              </div>
            )}

            <div className="form-actions">
              <button
                type="button"
                className="cancel-button"
                onClick={() => setShowAddForm(false)}
              >
                Annulla
              </button>
              <button
                type="submit"
                className="submit-button"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? "Aggiunta..." : "Aggiungi"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista */}
      <div className="invitees-list">
        {isLoading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Caricamento...</p>
          </div>
        ) : currentList.length === 0 ? (
          <div className="empty-list">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 11l3 3L22 4"/>
              <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
            </svg>
            <h3>Nessuna persona in lista</h3>
            <p>Aggiungi persone manualmente o sincronizza da Google Sheets</p>
          </div>
        ) : (
          <div className={`data-table-container ${activeTab === "paganti" ? "has-payment" : "no-payment"}`}>
            <table className="data-table">
              <colgroup>
                <col className="col-name" />
                <col className="col-last" />
                {activeTab === "paganti" && <col className="col-pay" />}
                <col className="col-status" />
              </colgroup>
              <thead>
                <tr>
                  <th className="sortable" onClick={() => toggleSort("firstName")}>
                    Nome {sortBy === "firstName" && (sortDir === "asc" ? "▲" : "▼")}
                  </th>
                  <th className="sortable" onClick={() => toggleSort("lastName")}>
                    Cognome {sortBy === "lastName" && (sortDir === "asc" ? "▲" : "▼")}
                  </th>
                  {activeTab === "paganti" && (
                    <th className="sortable" onClick={() => toggleSort("paymentType")}>
                      Pagamento {sortBy === "paymentType" && (sortDir === "asc" ? "▲" : "▼")}
                    </th>
                  )}
                  <th>Stato</th>
                </tr>
              </thead>
              <tbody>
                {sortedCurrent.map((person) => (
                  <tr key={person.id} className={person.hasEntered ? "entered" : ""}>
                    <td>{person.firstName}</td>
                    <td>{person.lastName}</td>
                    {activeTab === "paganti" && (
                      <td>
                        {person.paymentType && (
                          <span className="payment-badge">{person.paymentType}</span>
                        )}
                      </td>
                    )}
                    <td className="cell-status">
                      {isOrganizer ? (
                        person.hasEntered ? (
                          <span className={`status-badge ${person.hasEntered ? "entered" : "not-entered"} read-only`}>
                            Entrato
                          </span>
                        ) : (
                          <button
                            className={`status-badge ${person.hasEntered ? "entered" : "not-entered"}`}
                            onClick={() => handleCheckIn(person)}
                            disabled={checkInMutation.isPending}
                          >
                            Non entrato
                          </button>
                        )
                      ) : (
                        <button
                          className={`status-badge ${person.hasEntered ? "entered" : "not-entered"}`}
                          onClick={() => handleCheckIn(person)}
                          disabled={checkInMutation.isPending}
                        >
                          {person.hasEntered ? "Entrato" : "Non entrato"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
