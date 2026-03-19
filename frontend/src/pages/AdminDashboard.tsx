import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { useEvent } from "../context/EventContext";
import type { Invitee, InviteeInput, ListType } from "../api/invitees";
import {
  fetchInvitees,
  createInvitee,
  checkInPerson,
  deleteInvitee,
  syncGoogleSheets,
  fetchDuplicateInvitees,
  promoteDuplicateGroup,
  keepOneDuplicate,
  resetAndReimport,
  fetchStats,
  sendQrBulk,
  type Stats,
  type DuplicateGroup,
} from "../api/invitees";
import InviteeDetailModal from "../components/InviteeDetailModal";
import { fetchPreRegistrations } from "../api/preregistrations";
import type { PreRegistration } from "../api/preregistrations";
import "./AdminDashboard.css";

export default function AdminDashboard() {
  const { role } = useAuth();
  const { currentEvent } = useEvent();
  const eventId = currentEvent!.id;
  const isOrganizer = role === 'ORGANIZER';
  const navigate = useNavigate();

  const duplicatesRef = useRef<HTMLDivElement | null>(null);
  const hasShownDupHintRef = useRef(false);
  const [showDupHint, setShowDupHint] = useState(false);

  const [selectedInvitee, setSelectedInvitee] = useState<Invitee | null>(null);

  const [activeTab, setActiveTab] = useState<"paganti" | "green">("paganti");
  const [showAddForm, setShowAddForm] = useState(false);
  const firstNameInputRef = useRef<HTMLInputElement | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [formData, setFormData] = useState<InviteeInput>({
    firstName: "",
    lastName: "",
    listType: "PAGANTE",
    paymentType: "",
    email: "",
  });
  const [sortBy, setSortBy] = useState<"firstName" | "lastName" | "paymentType">("lastName");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const queryClient = useQueryClient();

  const { data: invitees = [], isLoading } = useQuery<Invitee[]>({
    queryKey: ["invitees", eventId],
    queryFn: () => fetchInvitees(eventId),
  });

  const { data: stats } = useQuery<Stats>({
    queryKey: ["stats", eventId],
    queryFn: () => fetchStats(eventId),
    refetchInterval: 5000,
  });

  const { data: duplicates = [] } = useQuery<DuplicateGroup[]>({
    queryKey: ["invitees", "duplicates", eventId],
    queryFn: () => fetchDuplicateInvitees(eventId),
    refetchInterval: 10000,
  });

  const { data: preRegs = [] } = useQuery<PreRegistration[]>({
    queryKey: ["preregistrations", eventId],
    queryFn: () => fetchPreRegistrations(eventId),
    refetchInterval: 30000,
  });
  const pendingCount = preRegs.filter(p => p.status === "PENDING").length;

  type LocalDupGroup = { key: string; count: number; crossList: boolean; items: Invitee[] };
  const [localDupGroups, setLocalDupGroups] = useState<LocalDupGroup[] | null>(null);
  const [localDupSummary, setLocalDupSummary] = useState<{ total: number; crossList: number } | null>(null);

  const analyzeDuplicates = () => {
    if (!invitees || invitees.length === 0) {
      setLocalDupGroups([]);
      setLocalDupSummary({ total: 0, crossList: 0 });
      return;
    }
    const norm = (s: string) => s
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
    const map = new Map<string, Invitee[]>();
    for (const inv of invitees) {
      const key = `${norm(inv.lastName)}|${norm(inv.firstName)}`;
      const arr = map.get(key) ?? [];
      arr.push(inv);
      map.set(key, arr);
    }
    const groups: LocalDupGroup[] = [];
    for (const [key, items] of map.entries()) {
      if (items.length > 1) {
        const hasPaganti = items.some(i => i.listType === "PAGANTE");
        const hasGreen = items.some(i => i.listType === "GREEN");
        groups.push({ key, count: items.length, crossList: hasPaganti && hasGreen, items: items.sort((a, b) => a.listType.localeCompare(b.listType)) });
      }
    }
    groups.sort((a, b) => Number(b.crossList) - Number(a.crossList) || b.count - a.count);
    setLocalDupGroups(groups);
    setLocalDupSummary({ total: groups.length, crossList: groups.filter(g => g.crossList).length });
    setShowDupHint(false);
    setTimeout(() => {
      duplicatesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  };

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

  useEffect(() => {
    if (activeTab === "green" && sortBy === "paymentType") {
      setSortBy("lastName");
      setSortDir("asc");
    }
  }, [activeTab]);

  const createMutation = useMutation({
    mutationFn: (payload: InviteeInput | InviteeInput[]) => createInvitee(eventId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invitees", eventId] });
      setFormData({
        firstName: "",
        lastName: "",
        listType: activeTab === "paganti" ? "PAGANTE" : "GREEN",
        paymentType: "",
        email: "",
      });
      setTimeout(() => {
        firstNameInputRef.current?.focus();
      }, 0);
    },
  });

  useEffect(() => {
    if (showAddForm) {
      setTimeout(() => {
        firstNameInputRef.current?.focus();
      }, 0);
    }
  }, [showAddForm]);

  useEffect(() => {
    if (!hasShownDupHintRef.current && duplicates.length > 0) {
      hasShownDupHintRef.current = true;
      setShowDupHint(true);
      setTimeout(() => setShowDupHint(false), 6000);
    }
  }, [duplicates.length]);

  const scrollToDuplicates = () => {
    const el = duplicatesRef.current;
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      el.classList.add('dup-highlight');
      setTimeout(() => el.classList.remove('dup-highlight'), 1500);
    }
  };

  const checkInMutation = useMutation({
    mutationFn: ({ id, adminOverride }: { id: string; adminOverride: boolean }) =>
      checkInPerson(eventId, id, adminOverride),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invitees", eventId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteInvitee(eventId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invitees", eventId] });
      queryClient.invalidateQueries({ queryKey: ["stats", eventId] });
    },
  });

  const handleDelete = (person: Invitee) => {
    if (!window.confirm(`Eliminare "${person.lastName} ${person.firstName}" definitivamente?\nVerrà rimosso anche dal foglio Google.`)) return;
    deleteMutation.mutate(person.id);
  };

  const syncMutation = useMutation({
    mutationFn: (opts?: { pruneMissing?: boolean }) => syncGoogleSheets(eventId, opts),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invitees", eventId] });
      queryClient.invalidateQueries({ queryKey: ["stats", eventId] });
      queryClient.invalidateQueries({ queryKey: ["invitees", "duplicates", eventId] });
    },
  });

  const resetMutation = useMutation({
    mutationFn: () => resetAndReimport(eventId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invitees", eventId] });
      queryClient.invalidateQueries({ queryKey: ["stats", eventId] });
      queryClient.invalidateQueries({ queryKey: ["invitees", "duplicates", eventId] });
    },
  });

  const [bulkQrResult, setBulkQrResult] = useState<string | null>(null);
  const sendQrBulkMutation = useMutation({
    mutationFn: () => sendQrBulk(eventId),
    onSuccess: (data) => {
      setBulkQrResult(`QR inviati: ${data.sent} ✓  |  Falliti: ${data.failed}  |  Senza email: ${data.skipped}`);
      setTimeout(() => setBulkQrResult(null), 8000);
    },
  });

  useEffect(() => {
    if (syncMutation.data && duplicates.length > 0) {
      setShowDupHint(true);
      setTimeout(() => setShowDupHint(false), 6000);
    }
  }, [syncMutation.data, duplicates.length]);

  const promoteMut = useMutation({
    mutationFn: (key: string) => promoteDuplicateGroup(eventId, key),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invitees", "duplicates", eventId] });
      queryClient.invalidateQueries({ queryKey: ["invitees", eventId] });
      queryClient.invalidateQueries({ queryKey: ["stats", eventId] });
    },
  });
  const keepOneMut = useMutation({
    mutationFn: ({ key, keepId }: { key: string; keepId: string }) => keepOneDuplicate(eventId, key, keepId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invitees", "duplicates", eventId] });
      queryClient.invalidateQueries({ queryKey: ["invitees", eventId] });
      queryClient.invalidateQueries({ queryKey: ["stats", eventId] });
    },
  });

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

  return (
    <div className="admin-dashboard">
      {selectedInvitee && (
        <InviteeDetailModal
          invitee={selectedInvitee}
          eventId={eventId}
          onClose={() => setSelectedInvitee(null)}
          isAdmin={role === "ADMIN"}
          canCheckIn={true}
        />
      )}
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
      {!isOrganizer && localDupGroups && (
        <div className="duplicates-alert" ref={duplicatesRef}>
          <svg viewBox="0 0 24 24" fill="currentColor" className="dup-icon">
            <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
          </svg>
          <div className="dup-content">
            <strong>Analisi duplicati (locale){localDupSummary ? ` — ${localDupSummary.total} gruppi, ${localDupSummary.crossList} cross-list` : ''}</strong>
            {localDupGroups.length === 0 ? (
              <div className="dup-list">Nessun duplicato trovato</div>
            ) : (
              <div className="dup-list">
                {localDupGroups.map((g) => (
                  <div key={g.key} className="dup-group">
                    <span className="dup-title">{g.items[0]?.lastName} {g.items[0]?.firstName}</span>
                    <span className="dup-count">×{g.count}</span>
                    {g.crossList && <span className="dup-badge" title="Presente sia in Paganti che in Green">Cross‑list</span>}
                    <div className="dup-items">
                      {g.items.map((p) => (
                        <span key={p.id} className="dup-badge">{p.listType}{p.paymentType ? ` • ${p.paymentType}` : ''}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
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
          className="sync-button"
          onClick={analyzeDuplicates}
          title="Analizza duplicati (anche tra Paganti e Green)"
          type="button"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/>
            <path d="M21 21l-4.35-4.35"/>
          </svg>
          Analizza duplicati
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
          className={`tab tab-green ${activeTab === "green" ? "active" : ""}`}
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
        <button
          className="tab tab-pending"
          onClick={() => navigate("/pre-registrations")}
        >
          <span className="tab-icon" aria-hidden>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
            </svg>
          </span>
          In attesa
          {pendingCount > 0 && <span className="tab-pending-badge">{pendingCount}</span>}
        </button>
      </div>

      <div className="actions-bar">
          <button className="add-button" onClick={() => setShowAddForm(!showAddForm)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14m-7-7h14"/>
          </svg>
          Aggiungi {activeTab === "paganti" ? "Pagante" : "Green"}
        </button>

        <button
          className="send-qr-bulk-button"
          onClick={() => {
            if (confirm("Inviare il QR via email a tutti gli invitati che hanno un indirizzo email?\nOgni persona riceverà un'email individuale da sesaorganizers@gmail.com.")) {
              sendQrBulkMutation.mutate();
            }
          }}
          disabled={sendQrBulkMutation.isPending}
          title="Invia QR code via email a tutti gli invitati con email"
        >
          {sendQrBulkMutation.isPending ? (
            <>
              <div className="spinner-small"></div>
              Invio in corso...
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" rx="1"/>
                <rect x="14" y="3" width="7" height="7" rx="1"/>
                <rect x="3" y="14" width="7" height="7" rx="1"/>
                <rect x="14" y="14" width="3" height="3"/>
                <rect x="18" y="14" width="3" height="3"/>
                <rect x="14" y="18" width="3" height="3"/>
                <rect x="18" y="18" width="3" height="3"/>
              </svg>
              Invia QR a tutti
            </>
          )}
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

      {bulkQrResult && (
        <div className="sync-result success">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
          </svg>
          <div><strong>Invio QR completato</strong><p>{bulkQrResult}</p></div>
        </div>
      )}

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

      {showAddForm && (
        <div className="add-form-container">
          <form className="add-form" onSubmit={handleSubmit} autoComplete="off">
            <h3>
              Aggiungi {activeTab === "paganti" ? "Pagante" : "Green"}
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

            <div className="form-field">
              <label>Email <span style={{ fontWeight: 400, color: "var(--text-muted)", fontSize: "12px" }}>(opzionale — per invio QR)</span></label>
              <input
                type="email"
                value={formData.email ?? ""}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="mario@example.com"
              />
            </div>

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
                    <td
                      className="cell-name-clickable"
                      onClick={() => setSelectedInvitee(person)}
                      title="Clicca per i dettagli"
                    >{person.firstName}</td>
                    <td
                      className="cell-name-clickable"
                      onClick={() => setSelectedInvitee(person)}
                      title="Clicca per i dettagli"
                    >{person.lastName}</td>
                    {activeTab === "paganti" && (
                      <td>
                        {person.paymentType && (
                          <span className="payment-badge">{person.paymentType}</span>
                        )}
                      </td>
                    )}
                    <td className="cell-status">
                      <div className="cell-status-inner">
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
                        <button
                          className="delete-row-btn"
                          onClick={() => handleDelete(person)}
                          disabled={deleteMutation.isPending}
                          title="Elimina persona"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6"/>
                          </svg>
                        </button>
                      </div>
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
