import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import {
  fetchTshirts,
  fetchTshirtStats,
  createTshirt,
  toggleTshirtReceived,
  deleteTshirt,
  syncTshirts,
  updateTshirt,
  type Tshirt,
  type TshirtInput,
  type TshirtStats
} from "../api/tshirts";
import { resetAndReimport, syncGoogleSheets } from "../api/invitees";
import "./TshirtsPage.css";

export default function TshirtsPage() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

  const [showAddForm, setShowAddForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"firstName" | "lastName" | "size" | "type">("lastName");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [formData, setFormData] = useState<TshirtInput>({
    firstName: "",
    lastName: "",
    size: "M",
    type: ""
  });

  // Query per magliette (admin: tutte, entrance: ricerca)
  const { data: tshirts = [], isLoading } = useQuery<Tshirt[]>({
    queryKey: ["tshirts", searchQuery],
    queryFn: () => fetchTshirts(searchQuery.length >= 2 ? searchQuery : undefined),
    enabled: isAdmin || searchQuery.length >= 2,
    refetchInterval: isAdmin ? 30000 : false
  });

  // Query per statistiche (solo admin)
  const { data: stats } = useQuery<TshirtStats>({
    queryKey: ["tshirts", "stats"],
    queryFn: fetchTshirtStats,
    enabled: isAdmin,
    refetchInterval: isAdmin ? 30000 : false
  });

  // Mutation per creare maglietta
  const createMutation = useMutation({
    mutationFn: createTshirt,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tshirts"] });
      setShowAddForm(false);
      setFormData({ firstName: "", lastName: "", size: "M", type: "" });
    }
  });

  // Mutation per toggle consegna
  const toggleMutation = useMutation({
    mutationFn: toggleTshirtReceived,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tshirts"] });
    }
  });

  // Mutation per eliminare
  const deleteMutation = useMutation({
    mutationFn: deleteTshirt,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tshirts"] });
    }
  });

  // Mutation per sync
  const [notice, setNotice] = useState<{
    kind: 'sync' | 'align' | 'reset';
    success: boolean;
    title: string;
    body: string;
  } | null>(null);

  const syncMutation = useMutation({
    mutationFn: () => syncTshirts(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["tshirts"] });
      queryClient.invalidateQueries({ queryKey: ["tshirts", "stats"] });
      setNotice({ kind: 'sync', success: true, title: 'Sincronizzazione completata!', body: `${data.newImported} nuove importate, ${data.alreadyExists} già presenti` });
    },
    onError: (err: any) => setNotice({ kind: 'sync', success: false, title: 'Errore sincronizzazione', body: err?.message || 'Errore imprevisto' })
  });

  const alignMutation = useMutation({
    mutationFn: async () => {
      const [people, tshirtsRes] = await Promise.all([
        syncGoogleSheets({ pruneMissing: true }),
        syncTshirts({ pruneMissing: true }),
      ]);
      return { people, tshirts: tshirtsRes } as any;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["tshirts"] });
      queryClient.invalidateQueries({ queryKey: ["tshirts", "stats"] });
      setNotice({ kind: 'align', success: true, title: 'Allineamento completato!', body: `Magliette: +${data.tshirts.newImported} nuove, ${data.tshirts.alreadyExists} già presenti. Invitati: +${data.people.newImported}/${data.people.totalFromSheet} (mancanti rimossi)` });
    },
    onError: (err: any) => setNotice({ kind: 'align', success: false, title: 'Errore allineamento', body: err?.message || 'Errore imprevisto' })
  });

  const resetAllMutation = useMutation({
    mutationFn: resetAndReimport,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["tshirts"] });
      queryClient.invalidateQueries({ queryKey: ["tshirts", "stats"] });
      setNotice({ kind: 'reset', success: true, title: 'Reset + Reimport completato!', body: `Reset: ${data.reset.deletedInvitees} invitati, ${data.reset.deletedLogs} log, ${data.reset.deletedTshirts} magliette. Import: +${data.import.newImported} invitati, +${data.tshirts.newImported} magliette` });
    },
    onError: (err: any) => setNotice({ kind: 'reset', success: false, title: 'Errore reset/reimport', body: err?.message || 'Errore imprevisto' })
  });

  // Mutation aggiornamento taglia/tipologia
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Pick<Tshirt, 'size' | 'type'>> }) => updateTshirt(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tshirts"] });
    }
  });

  // Capitalizza automaticamente
  const capitalizeWords = (str: string): string => {
    return str
      .split(' ')
      .map(word => word ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : '')
      .join(' ');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      ...formData,
      firstName: capitalizeWords(formData.firstName.trim()),
      lastName: capitalizeWords(formData.lastName.trim())
    });
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Sei sicuro di voler eliminare la maglietta per "${name}"?`)) {
      deleteMutation.mutate(id);
    }
  };

  const toggleSort = (key: typeof sortBy) => {
    if (sortBy === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(key);
      setSortDir("asc");
    }
  };

  const sortedTshirts = [...tshirts].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    const av = (a[sortBy] ?? "").toString();
    const bv = (b[sortBy] ?? "").toString();
    return av.localeCompare(bv, "it", { sensitivity: "base", numeric: true }) * dir;
  });

  return (
    <div className="tshirts-page">
      {/* Header con sync button (solo admin) */}
      <div className="tshirts-header">
        <div className="tshirt-title" aria-label="Pagina Magliette">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M16 3c-1.2 1-2.6 2-4 2s-2.8-1-4-2L4 6l2 2v13a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8l2-2-4-3z"/>
            <path d="M9 8h6"/>
          </svg>
          <h2>Magliette</h2>
        </div>

        {isAdmin && (
          <div className="tshirts-actions">
            <button
              className="sync-button"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              title="Sincronizza (solo import)"
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
                  Sincronizza
                </>
              )}
            </button>
            <button
              className="sync-button"
              onClick={() => alignMutation.mutate()}
              disabled={alignMutation.isPending}
              title="Allinea (rimuove mancanti)"
            >
              {alignMutation.isPending ? 'Allineamento...' : 'Allinea (rimuovi mancanti)'}
            </button>
            <button
              className="reset-button"
              onClick={() => {
                if (confirm('Confermi il reset di INVITATI + LOG + TSHIRTS e reimport da Google Sheets?')) {
                  resetAllMutation.mutate();
                }
              }}
              disabled={resetAllMutation.isPending}
            >
              {resetAllMutation.isPending ? 'Reset/Reimport...' : 'Reset + Reimport'}
            </button>
          </div>
        )}
      </div>

      {/* Banner risultato azioni (sync/allinea/reset) */}
      {notice && (
        <div className={`sync-result ${notice.success ? 'success' : 'error'}`}>
          <svg viewBox="0 0 24 24" fill="currentColor">
            {notice.success ? (
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
            ) : (
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
            )}
          </svg>
          <div>
            <strong>{notice.title}</strong>
            <p>{notice.body}</p>
          </div>
        </div>
      )}

      {/* Statistiche (solo admin) */}
      {isAdmin && stats && (
        <div className="stats-container">
          <div className="stat-card">
            <div className="stat-label">Totale</div>
            <div className="stat-value">{stats.total}</div>
          </div>
          <div className="stat-card received">
            <div className="stat-label">Consegnate</div>
            <div className="stat-value">{stats.received}</div>
          </div>
          <div className="stat-card pending">
            <div className="stat-label">Da Consegnare</div>
            <div className="stat-value">{stats.pending}</div>
          </div>
        </div>
      )}

      {/* Statistiche per taglia (solo admin) */}
      {isAdmin && stats && Object.keys(stats.bySizeAndType).length > 0 && (
        <div className="size-stats">
          <h3>Statistiche per Taglia</h3>
          <div className="size-grid">
            {Object.entries(stats.bySizeAndType)
              .sort(([a], [b]) => {
                const order = ['S', 'M', 'L', 'XL', '2XL'];
                const ia = order.indexOf(a);
                const ib = order.indexOf(b);
                const va = ia === -1 ? 999 : ia;
                const vb = ib === -1 ? 999 : ib;
                return va - vb;
              })
              .map(([size, data]) => (
                <div key={size} className="size-item">
                  <div className="size-name">{size}</div>
                  <div className="size-count">{data.total} totali</div>
                  <div className="size-details">
                    <span className="received-count">{data.received} consegnate</span>
                    <span className="pending-count">{data.pending} da consegnare</span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Barra ricerca */}
      <div className="search-container">
        <div className="search-box">
          <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="11" cy="11" r="8" strokeWidth="2"/>
            <path d="M21 21l-4.35-4.35" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <input
            type="text"
            className="search-input"
            placeholder={isAdmin ? "Cerca maglietta..." : "Cerca maglietta PR o Vincitore..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="clear-button" onClick={() => setSearchQuery("")}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M18 6L6 18M6 6l12 12" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
          )}
        </div>
        {!isAdmin && searchQuery.length < 2 && (
          <div className="search-hint">Digita almeno 2 caratteri per cercare...</div>
        )}
      </div>

      {/* Pulsante Aggiungi (solo admin) */}
      {isAdmin && (
        <div className="actions-bar">
          <button className="add-button" onClick={() => setShowAddForm(!showAddForm)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14m-7-7h14"/>
            </svg>
            Aggiungi Maglietta
          </button>
        </div>
      )}

      {/* Form aggiunta (solo admin) */}
      {isAdmin && showAddForm && (
        <div className="add-form-container">
          <form className="add-form" onSubmit={handleSubmit}>
            <h3>Aggiungi Maglietta</h3>

            <div className="form-row">
              <div className="form-field">
                <label>Nome *</label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => {
                    const capitalized = capitalizeWords(e.target.value);
                    setFormData({ ...formData, firstName: capitalized });
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
                    const capitalized = capitalizeWords(e.target.value);
                    setFormData({ ...formData, lastName: capitalized });
                  }}
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-field">
                <label>Taglia *</label>
                <select
                  value={formData.size}
                  onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                  required
                >
                  <option value="S">S</option>
                  <option value="M">M</option>
                  <option value="L">L</option>
                  <option value="XL">XL</option>
                  <option value="2XL">2XL</option>
                  
                </select>
              </div>

              <div className="form-field">
                <label>Tipologia</label>
                <input
                  type="text"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  placeholder="es. PR, Vincitore, COMPRARE ALTRE..."
                />
              </div>
            </div>

            <div className="form-actions">
              <button type="button" className="cancel-button" onClick={() => setShowAddForm(false)}>
                Annulla
              </button>
              <button type="submit" className="submit-button" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Aggiunta..." : "Aggiungi"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista magliette */}
      <div className="tshirts-list">
        {isLoading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Caricamento...</p>
          </div>
        ) : tshirts.length === 0 ? (
          <div className="empty-list">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 11l3 3L22 4"/>
              <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
            </svg>
            <h3>{isAdmin ? "Nessuna maglietta in lista" : "Nessun risultato"}</h3>
            <p>{isAdmin ? "Aggiungi magliette manualmente o sincronizza da Google Sheets" : "Prova con un'altra ricerca"}</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="tshirts-table">
              <thead>
                <tr>
                  <th className="sortable" onClick={() => toggleSort("firstName")}>
                    Nome {sortBy === "firstName" && (sortDir === "asc" ? "▲" : "▼")}
                  </th>
                  <th className="sortable" onClick={() => toggleSort("lastName")}>
                    Cognome {sortBy === "lastName" && (sortDir === "asc" ? "▲" : "▼")}
                  </th>
                  <th className="sortable" onClick={() => toggleSort("size")}>
                    Taglia {sortBy === "size" && (sortDir === "asc" ? "▲" : "▼")}
                  </th>
                  <th className="sortable" onClick={() => toggleSort("type")}>
                    Tipologia {sortBy === "type" && (sortDir === "asc" ? "▲" : "▼")}
                  </th>
                  <th>Stato</th>
                  {isAdmin && <th>Azioni</th>}
                </tr>
              </thead>
              <tbody>
                {sortedTshirts.map((tshirt) => (
                  <tr key={tshirt.id} className={tshirt.hasReceived ? "received" : ""}>
                    <td data-label="Nome">{tshirt.firstName}</td>
                    <td data-label="Cognome">{tshirt.lastName}</td>
                    <td data-label="Taglia">
                      {isAdmin ? (
                        <select
                          className="pill-select size-pill"
                          value={tshirt.size}
                          onChange={(e) => updateMutation.mutate({ id: tshirt.id, data: { size: e.target.value } })}
                          disabled={updateMutation.isPending}
                          aria-label={`Taglia per ${tshirt.firstName} ${tshirt.lastName}`}
                        >
                          <option value="S">S</option>
                          <option value="M">M</option>
                          <option value="L">L</option>
                          <option value="XL">XL</option>
                          <option value="2XL">2XL</option>
                          
                        </select>
                      ) : (
                        <span className="size-badge">{tshirt.size}</span>
                      )}
                    </td>
                    <td data-label="Tipologia">
                      {isAdmin ? (
                        <>
                          <input
                            className="pill-input type-pill"
                            list="tshirt-types"
                            defaultValue={tshirt.type || ""}
                            placeholder="es. PR, Vincitore, Bar..."
                            onChange={(e) => {
                              const newVal = e.currentTarget.value.trim();
                              if (newVal && newVal !== tshirt.type) {
                                updateMutation.mutate({ id: tshirt.id, data: { type: newVal } });
                              }
                            }}
                            onBlur={(e) => {
                              const newVal = e.currentTarget.value.trim();
                              if (newVal !== tshirt.type) {
                                updateMutation.mutate({ id: tshirt.id, data: { type: newVal } });
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const target = e.currentTarget as HTMLInputElement;
                                const newVal = target.value.trim();
                                if (newVal !== tshirt.type) {
                                  updateMutation.mutate({ id: tshirt.id, data: { type: newVal } });
                                }
                              }
                            }}
                            aria-label={`Tipologia per ${tshirt.firstName} ${tshirt.lastName}`}
                          />
                          <datalist id="tshirt-types">
                            <option value="PR" />
                            <option value="Vincitore" />
                            <option value="Bar" />
                            <option value="COMPRARE ALTRE" />
                            <option value="Apposto" />
                          </datalist>
                        </>
                      ) : (
                        <span className="type-badge">{tshirt.type || "—"}</span>
                      )}
                    </td>
                    <td>
                      <button
                        className={`status-badge ${tshirt.hasReceived ? "received" : "pending"}`}
                        onClick={() => toggleMutation.mutate(tshirt.id)}
                        disabled={toggleMutation.isPending}
                      >
                        {tshirt.hasReceived ? "Consegnata" : "Da Consegnare"}
                      </button>
                    </td>
                    {isAdmin && (
                      <td>
                        <button
                          className="delete-button"
                          onClick={() => handleDelete(tshirt.id, `${tshirt.lastName} ${tshirt.firstName}`)}
                          disabled={deleteMutation.isPending}
                          title="Elimina"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                          </svg>
                        </button>
                      </td>
                    )}
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
