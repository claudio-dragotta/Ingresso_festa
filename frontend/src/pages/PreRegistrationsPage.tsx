import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEvent } from "../context/EventContext";
import type { PreRegistration } from "../api/preregistrations";
import type { ListType } from "../api/invitees";
import {
  fetchPreRegistrations,
  approvePreRegistration,
  rejectPreRegistration,
  deletePreRegistration,
} from "../api/preregistrations";
import "./PreRegistrationsPage.css";


export default function PreRegistrationsPage() {
  const { currentEvent } = useEvent();
  const eventId = currentEvent!.id;
  const qc = useQueryClient();

  const [filter, setFilter] = useState<"PENDING" | "APPROVED" | "REJECTED" | "ALL">("PENDING");
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [approveForm, setApproveForm] = useState<{ listType: ListType; paymentType: string }>({
    listType: "PAGANTE",
    paymentType: "",
  });

  const { data: items = [], isLoading } = useQuery<PreRegistration[]>({
    queryKey: ["preregistrations", eventId],
    queryFn: () => fetchPreRegistrations(eventId),
    refetchInterval: 15000,
  });

  const approveMut = useMutation({
    mutationFn: (id: string) =>
      approvePreRegistration(eventId, id, {
        listType: approveForm.listType,
        paymentType: approveForm.paymentType || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["preregistrations", eventId] });
      qc.invalidateQueries({ queryKey: ["invitees", eventId] });
      setApprovingId(null);
    },
  });

  const rejectMut = useMutation({
    mutationFn: (id: string) => rejectPreRegistration(eventId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["preregistrations", eventId] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deletePreRegistration(eventId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["preregistrations", eventId] }),
  });

  const publicLink = `${window.location.origin}/register/${eventId}`;
  const pendingCount = items.filter(i => i.status === "PENDING").length;

  const filtered = filter === "ALL" ? items : items.filter(i => i.status === filter);

  const copyLink = () => {
    navigator.clipboard.writeText(publicLink);
  };

  return (
    <div className="prereg-page">
      {/* ── Header ── */}
      <div className="prereg-header">
        <div className="prereg-title-row">
          <h2 className="prereg-title">Pre-registrazioni</h2>
          {pendingCount > 0 && <span className="prereg-badge">{pendingCount}</span>}
        </div>
        <p className="prereg-subtitle">
          Gestisci le richieste di accesso degli invitati. Approva chi ha pagato per aggiungerlo alla lista.
        </p>

        {/* Link pubblico */}
        <div className="prereg-link-box">
          <span className="prereg-link-label">Link da condividere</span>
          <div className="prereg-link-row">
            <input className="prereg-link-input" value={publicLink} readOnly />
            <button className="prereg-copy-btn" onClick={copyLink}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2"/>
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
              </svg>
              Copia
            </button>
          </div>
        </div>
      </div>

      {/* ── Filtri ── */}
      <div className="prereg-filters">
        {(["PENDING", "APPROVED", "REJECTED", "ALL"] as const).map(f => (
          <button
            key={f}
            className={`prereg-filter-btn ${filter === f ? "active" : ""} ${f.toLowerCase()}`}
            onClick={() => setFilter(f)}
          >
            {f === "PENDING" ? "In attesa" : f === "APPROVED" ? "Approvati" : f === "REJECTED" ? "Rifiutati" : "Tutti"}
            <span className="prereg-filter-count">
              {f === "ALL" ? items.length : items.filter(i => i.status === f).length}
            </span>
          </button>
        ))}
      </div>

      {/* ── Lista ── */}
      {isLoading ? (
        <div className="prereg-empty">Caricamento...</div>
      ) : filtered.length === 0 ? (
        <div className="prereg-empty">
          {filter === "PENDING"
            ? "Nessuna richiesta in attesa"
            : "Nessun elemento"}
        </div>
      ) : (
        <div className="prereg-list">
          {filtered.map(item => (
            <div key={item.id} className={`prereg-item ${item.status.toLowerCase()}`}>
              <div className="prereg-item-main">
                <div className="prereg-person">
                  <span className="prereg-name">
                    {item.lastName} {item.firstName}
                  </span>
                  <span className="prereg-email">{item.email}</span>
                  {item.notes && <span className="prereg-notes">Note: {item.notes}</span>}
                </div>
                <div className="prereg-item-right">
                  <span className={`prereg-status-badge ${item.status.toLowerCase()}`}>
                    {item.status === "PENDING" ? "In attesa" : item.status === "APPROVED" ? "Approvato" : "Rifiutato"}
                  </span>
                  <span className="prereg-date">
                    {new Date(item.createdAt).toLocaleDateString("it-IT", {
                      day: "2-digit", month: "2-digit", year: "numeric",
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>

              {/* Pannello approvazione */}
              {item.status === "PENDING" && (
                <div className="prereg-actions">
                  {approvingId === item.id ? (
                    <div className="prereg-approve-form">
                      <select
                        className="prereg-select"
                        value={approveForm.listType}
                        onChange={e => setApproveForm(f => ({ ...f, listType: e.target.value as ListType }))}
                      >
                        <option value="PAGANTE">Pagante</option>
                        <option value="GREEN">Green</option>
                      </select>
                      <input
                        className="prereg-input"
                        placeholder="Tipo pagamento (es. contanti)"
                        value={approveForm.paymentType}
                        onChange={e => setApproveForm(f => ({ ...f, paymentType: e.target.value }))}
                      />
                      <div className="prereg-approve-btns">
                        <button
                          className="prereg-btn approve"
                          disabled={approveMut.isPending}
                          onClick={() => approveMut.mutate(item.id)}
                        >
                          {approveMut.isPending ? "..." : "Conferma"}
                        </button>
                        <button
                          className="prereg-btn cancel"
                          onClick={() => setApprovingId(null)}
                        >
                          Annulla
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="prereg-action-btns">
                      <button
                        className="prereg-btn approve"
                        onClick={() => {
                          setApproveForm({ listType: "PAGANTE", paymentType: "" });
                          setApprovingId(item.id);
                        }}
                      >
                        Approva
                      </button>
                      <button
                        className="prereg-btn reject"
                        disabled={rejectMut.isPending}
                        onClick={() => rejectMut.mutate(item.id)}
                      >
                        Rifiuta
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Elimina (per approvati/rifiutati) */}
              {item.status !== "PENDING" && (
                <div className="prereg-actions">
                  <button
                    className="prereg-btn delete"
                    disabled={deleteMut.isPending}
                    onClick={() => deleteMut.mutate(item.id)}
                  >
                    Elimina
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
