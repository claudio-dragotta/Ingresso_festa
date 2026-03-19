import { useState, useRef, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Invitee } from "../api/invitees";
import { updateInviteeEmail, sendQrToInvitee, checkInPerson } from "../api/invitees";
import "./InviteeDetailModal.css";

interface Props {
  invitee: Invitee;
  eventId: string;
  onClose: () => void;
  isAdmin: boolean;
  canCheckIn?: boolean;
}

export default function InviteeDetailModal({ invitee, eventId, onClose, isAdmin, canCheckIn = true }: Props) {
  const queryClient = useQueryClient();
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailValue, setEmailValue] = useState(invitee.email ?? "");
  const emailInputRef = useRef<HTMLInputElement>(null);

  const [qrResult, setQrResult] = useState<{ success: boolean; message: string } | null>(null);
  const [bulkResult, setBulkResult] = useState<string | null>(null);

  useEffect(() => {
    if (editingEmail) emailInputRef.current?.focus();
  }, [editingEmail]);

  // Chiudi con Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const emailMutation = useMutation({
    mutationFn: (email: string | null) => updateInviteeEmail(eventId, invitee.id, email),
    onSuccess: (updated) => {
      setEditingEmail(false);
      setEmailValue(updated.email ?? "");
      queryClient.invalidateQueries({ queryKey: ["invitees", eventId] });
      queryClient.invalidateQueries({ queryKey: ["search", eventId] });
    },
  });

  const sendQrMutation = useMutation({
    mutationFn: () => sendQrToInvitee(eventId, invitee.id),
    onSuccess: () => {
      setQrResult({ success: true, message: `QR inviato a ${emailValue}` });
      queryClient.invalidateQueries({ queryKey: ["invitees", eventId] });
      setTimeout(() => setQrResult(null), 4000);
    },
    onError: (err: any) => {
      setQrResult({ success: false, message: err?.response?.data?.message ?? "Errore invio QR" });
      setTimeout(() => setQrResult(null), 4000);
    },
  });

  const checkInMutation = useMutation({
    mutationFn: () => checkInPerson(eventId, invitee.id, isAdmin && invitee.hasEntered),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invitees", eventId] });
      queryClient.invalidateQueries({ queryKey: ["search", eventId] });
      queryClient.invalidateQueries({ queryKey: ["stats", eventId] });
      onClose();
    },
  });

  const handleSaveEmail = () => {
    emailMutation.mutate(emailValue.trim() || null);
  };

  const handleDownloadQr = () => {
    window.open(`${import.meta.env.VITE_API_URL ?? ""}/api/events/${eventId}/invitees/${invitee.id}/qr-image`, "_blank");
  };

  const listLabel = invitee.listType === "PAGANTE" ? "Pagante" : "Green";
  const listClass = invitee.listType === "PAGANTE" ? "pagante" : "green";

  const formatDate = (iso?: string | null) => {
    if (!iso) return null;
    return new Date(iso).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-drawer" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-group">
            <span className={`modal-list-badge ${listClass}`}>{listLabel}</span>
            <h2 className="modal-name">{invitee.lastName} {invitee.firstName}</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Chiudi">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="modal-body">
          {/* Stato ingresso */}
          <div className="modal-section">
            <div className="modal-field">
              <span className="modal-field-label">Stato</span>
              <span className={`status-pill ${invitee.hasEntered ? "entered" : "not-entered"}`}>
                {invitee.hasEntered ? "Entrato" : "Non entrato"}
              </span>
            </div>
            {invitee.checkedInAt && (
              <div className="modal-field">
                <span className="modal-field-label">Entrato alle</span>
                <span className="modal-field-value">{formatDate(invitee.checkedInAt)}</span>
              </div>
            )}
            {invitee.paymentType && (
              <div className="modal-field">
                <span className="modal-field-label">Pagamento</span>
                <span className="modal-field-value">{invitee.paymentType}</span>
              </div>
            )}
          </div>

          {/* Email */}
          <div className="modal-section">
            <div className="modal-field modal-field-email">
              <span className="modal-field-label">Email</span>
              {editingEmail ? (
                <div className="email-edit-row">
                  <input
                    ref={emailInputRef}
                    type="email"
                    className="email-input"
                    value={emailValue}
                    onChange={e => setEmailValue(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleSaveEmail(); if (e.key === "Escape") { setEditingEmail(false); setEmailValue(invitee.email ?? ""); } }}
                    placeholder="mario@example.com"
                  />
                  <button className="btn-save-email" onClick={handleSaveEmail} disabled={emailMutation.isPending}>
                    {emailMutation.isPending ? "..." : "Salva"}
                  </button>
                  <button className="btn-cancel-email" onClick={() => { setEditingEmail(false); setEmailValue(invitee.email ?? ""); }}>
                    Annulla
                  </button>
                </div>
              ) : (
                <div className="email-display-row">
                  <span className="modal-field-value email-value">
                    {invitee.email ?? <span className="no-email">Non impostata</span>}
                  </span>
                  {isAdmin && (
                    <button className="btn-edit-email" onClick={() => setEditingEmail(true)}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                      Modifica
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* QR info */}
            {invitee.qrSentAt && (
              <div className="modal-field">
                <span className="modal-field-label">QR inviato</span>
                <span className="modal-field-value qr-sent-date">{formatDate(invitee.qrSentAt)}</span>
              </div>
            )}

            {qrResult && (
              <div className={`qr-result-banner ${qrResult.success ? "success" : "error"}`}>
                {qrResult.message}
              </div>
            )}
            {bulkResult && <div className="qr-result-banner success">{bulkResult}</div>}
          </div>
        </div>

        {/* Footer actions */}
        <div className="modal-footer">
          {canCheckIn && (
            <button
              className={`modal-btn ${invitee.hasEntered ? "btn-undo-checkin" : "btn-checkin"}`}
              onClick={() => checkInMutation.mutate()}
              disabled={checkInMutation.isPending || (!isAdmin && invitee.hasEntered)}
            >
              {invitee.hasEntered ? (isAdmin ? "Annulla ingresso" : "Già entrato") : "Segna ingresso"}
            </button>
          )}

          {isAdmin && invitee.email && (
            <button
              className="modal-btn btn-send-qr"
              onClick={() => sendQrMutation.mutate()}
              disabled={sendQrMutation.isPending}
            >
              {sendQrMutation.isPending ? "Invio..." : (invitee.qrSentAt ? "Reinvia QR" : "Invia QR")}
            </button>
          )}

          {isAdmin && (
            <button className="modal-btn btn-download-qr" onClick={handleDownloadQr}>
              Scarica QR
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
