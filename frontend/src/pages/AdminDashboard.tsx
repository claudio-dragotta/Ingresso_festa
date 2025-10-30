import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Invitee, InviteeInput, ListType } from "../api/invitees";
import {
  fetchInvitees,
  createInvitee,
  deleteInvitee,
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
  const [activeTab, setActiveTab] = useState<"paganti" | "green">("paganti");
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState<InviteeInput>({
    firstName: "",
    lastName: "",
    listType: "PAGANTE",
    paymentType: "",
  });

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

  // Mutation per creare invitato
  const createMutation = useMutation({
    mutationFn: createInvitee,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invitees"] });
      setShowAddForm(false);
      setFormData({
        firstName: "",
        lastName: "",
        listType: activeTab === "paganti" ? "PAGANTE" : "GREEN",
        paymentType: "",
      });
    },
  });

  // Mutation per eliminare
  const deleteMutation = useMutation({
    mutationFn: deleteInvitee,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invitees"] });
    },
  });

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
  });

  const resetMutation = useMutation({
    mutationFn: resetAndReimport,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invitees"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["invitees", "duplicates"] });
    },
  });

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const dataToSubmit = {
      ...formData,
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

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Sei sicuro di voler eliminare "${name}"?`)) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="admin-dashboard">
      {duplicates.length > 0 && (
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
      {duplicates.length > 0 && (
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
      {/* Header */}
      <div className="dashboard-header">
        <div>
          <h1>Dashboard Admin</h1>
          <p className="subtitle">Gestisci gli ingressi alla festa</p>
        </div>

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
          className="cancel-button"
          onClick={() => {
            if (confirm('Confermi il reset degli invitati e il reimport da Google Sheets?')) {
              resetMutation.mutate();
            }
          }}
          disabled={resetMutation.isPending}
        >
          {resetMutation.isPending ? 'Reset/Reimport...' : 'Reset + Reimport'}
        </button>
      </div>

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

      {/* Add Button */}
      <div className="actions-bar">
        <button className="add-button" onClick={() => setShowAddForm(!showAddForm)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14m-7-7h14"/>
          </svg>
          Aggiungi {activeTab === "paganti" ? "Pagante" : "Green"}
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

      {/* Add Form */}
      {showAddForm && (
        <div className="add-form-container">
          <form className="add-form" onSubmit={handleSubmit}>
            <h3>
              Aggiungi {activeTab === "paganti" ? "Pagante" : "Green"}
            </h3>

            <div className="form-row">
              <div className="form-field">
                <label>Nome *</label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  required
                />
              </div>

              <div className="form-field">
                <label>Cognome *</label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  required
                />
              </div>
            </div>

            {activeTab === "paganti" && (
              <div className="form-field">
                <label>Tipologia Pagamento</label>
                <select
                  value={formData.paymentType}
                  onChange={(e) => setFormData({ ...formData, paymentType: e.target.value })}
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
          <div className="table-container">
            <table className="invitees-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Cognome</th>
                  {activeTab === "paganti" && <th>Pagamento</th>}
                  <th>Stato</th>
                  <th>Azioni</th>
                </tr>
              </thead>
              <tbody>
                {currentList.map((person) => (
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
                    <td>
                      <button
                        className={`status-badge ${person.hasEntered ? "entered" : "not-entered"}`}
                        onClick={() => handleCheckIn(person)}
                        disabled={checkInMutation.isPending}
                      >
                        {person.hasEntered ? "Entrato" : "Non entrato"}
                      </button>
                    </td>
                    <td>
                      <button
                        className="delete-button"
                        onClick={() => handleDelete(person.id, `${person.lastName} ${person.firstName}`)}
                        disabled={deleteMutation.isPending}
                        title="Elimina"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                        </svg>
                      </button>
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
