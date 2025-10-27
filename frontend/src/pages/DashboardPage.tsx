import { useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import {
  createInvitee,
  downloadInviteeQr,
  fetchInvitees,
  fetchMetrics,
  fetchSystemConfig,
  resetInviteeCheckIn,
  sendInviteeQr,
  updateEventStatus,
  uploadInviteesFile,
} from "../api/invitees";
import type { EventStatus, Invitee, InviteeInput, InviteeStatus } from "../api/invitees";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const statusLabels: Record<InviteeStatus, string> = {
  PENDING: "In attesa",
  CHECKED_IN: "Entrato",
  CANCELLED: "Annullato",
};

const statusOptions: { value: EventStatus; label: string; description: string }[] = [
  { value: "ACTIVE", label: "Attivo", description: "Accetta scansioni normalmente" },
  { value: "PAUSED", label: "In pausa", description: "Mostra messaggio di sospensione" },
  { value: "LOCKED", label: "Bloccato", description: "Rifiuta qualsiasi accesso" },
];

const DashboardPage = () => {
  const queryClient = useQueryClient();
  const [bulkInput, setBulkInput] = useState("");
  const [uploadSummary, setUploadSummary] = useState<string | null>(null);
  const [fileUploading, setFileUploading] = useState(false);

  const inviteesQuery = useQuery({ queryKey: ["invitees"], queryFn: fetchInvitees });
  const metricsQuery = useQuery({ queryKey: ["metrics"], queryFn: fetchMetrics });
  const systemConfigQuery = useQuery({ queryKey: ["systemConfig"], queryFn: fetchSystemConfig });

  const createInviteeMutation = useMutation({
    mutationFn: (payload: InviteeInput | InviteeInput[]) => createInvitee(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invitees"] });
      queryClient.invalidateQueries({ queryKey: ["metrics"] });
    },
  });

  const resetMutation = useMutation({
    mutationFn: (inviteeId: string) => resetInviteeCheckIn(inviteeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invitees"] });
      queryClient.invalidateQueries({ queryKey: ["metrics"] });
    },
  });

  const sendMutation = useMutation({
    mutationFn: (inviteeId: string) => sendInviteeQr(inviteeId),
  });

  const statusMutation = useMutation({
    mutationFn: (status: EventStatus) => updateEventStatus(status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["systemConfig"] });
    },
  });

  const invitees = inviteesQuery.data ?? [];

  const pendingInvitees = useMemo(
    () => invitees.filter((invitee) => invitee.status === "PENDING"),
    [invitees],
  );
  const checkedInInvitees = useMemo(
    () => invitees.filter((invitee) => invitee.status === "CHECKED_IN"),
    [invitees],
  );

  const handleManualSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const firstName = String(formData.get("firstName") ?? "").trim();
    const lastName = String(formData.get("lastName") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const phone = String(formData.get("phone") ?? "").trim();

    if (!firstName || !lastName) {
      return;
    }

    await createInviteeMutation.mutateAsync({
      firstName,
      lastName,
      email: email || undefined,
      phone: phone || undefined,
    });

    event.currentTarget.reset();
  };

  const handleBulkSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!bulkInput.trim()) return;

    const rows = bulkInput
      .split("\n")
      .map((row) => row.trim())
      .filter(Boolean)
      .map((row) => {
        const parts = row.split(/[;,\t]/).map((part) => part.trim());
        const [firstName, lastName, email] = parts;
        if (!firstName || !lastName) {
          return null;
        }
        return {
          firstName,
          lastName,
          email: email || undefined,
        } satisfies InviteeInput;
      })
      .filter(Boolean) as InviteeInput[];

    if (rows.length === 0) {
      return;
    }

    await createInviteeMutation.mutateAsync(rows);
    setBulkInput("");
  };

  const handleUploadFile = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files?.[0]) return;
    setFileUploading(true);
    const file = event.target.files[0];
    try {
      const result = await uploadInviteesFile(file);
      setUploadSummary(
        `Importati ${result.imported} invitati su ${result.total} (saltati: ${result.skipped}).`,
      );
      queryClient.invalidateQueries({ queryKey: ["invitees"] });
      queryClient.invalidateQueries({ queryKey: ["metrics"] });
    } catch (error) {
      setUploadSummary("Errore durante l'importazione");
    } finally {
      setFileUploading(false);
      event.target.value = "";
    }
  };

  const handleDownloadQr = async (invitee: Invitee) => {
    const blob = await downloadInviteeQr(invitee.id);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = invitee.qrFilename ?? `${invitee.firstName}-${invitee.lastName}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const renderStatus = (status: InviteeStatus) => (
    <span className={`status-badge status-${status}`}>{statusLabels[status]}</span>
  );

  return (
    <div className="grid" style={{ gap: "1.5rem" }}>
      <section className="grid metrics-grid">
        <div className="card metrics-card">
          <span className="tag">Totale</span>
          <strong style={{ fontSize: "1.75rem" }}>{metricsQuery.data?.total ?? "-"}</strong>
        </div>
        <div className="card metrics-card">
          <span className="tag">Entrati</span>
          <strong style={{ fontSize: "1.75rem" }}>{metricsQuery.data?.checkedIn ?? "-"}</strong>
        </div>
        <div className="card metrics-card">
          <span className="tag">In arrivo</span>
          <strong style={{ fontSize: "1.75rem" }}>{metricsQuery.data?.pending ?? "-"}</strong>
        </div>
        <div className="card metrics-card">
          <span className="tag">Annullati</span>
          <strong style={{ fontSize: "1.75rem" }}>{metricsQuery.data?.cancelled ?? "-"}</strong>
        </div>
      </section>

      <section className="card">
        <h2>Stato evento</h2>
        <p>Scegli il comportamento della pagina di scansione.</p>
        <div className="grid" style={{ gap: "0.75rem" }}>
          {statusOptions.map((option) => (
            <label key={option.value} style={{ display: "flex", gap: "0.8rem" }}>
              <input
                type="radio"
                name="eventStatus"
                value={option.value}
                checked={systemConfigQuery.data?.eventStatus === option.value}
                onChange={() => statusMutation.mutate(option.value)}
                disabled={statusMutation.isPending}
              />
              <span>
                <strong>{option.label}</strong>
                <br />
                <small>{option.description}</small>
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="card grid" style={{ gap: "1.25rem" }}>
        <h2>Nuovi invitati</h2>
        <form className="grid" style={{ gap: "0.75rem" }} onSubmit={handleManualSubmit}>
          <div className="flex">
            <label className="flex column" style={{ flex: 1 }}>
              <span>Nome</span>
              <input name="firstName" placeholder="Es. Maria" required />
            </label>
            <label className="flex column" style={{ flex: 1 }}>
              <span>Cognome</span>
              <input name="lastName" placeholder="Es. Rossi" required />
            </label>
          </div>
          <div className="flex">
            <label className="flex column" style={{ flex: 1 }}>
              <span>Email (opzionale)</span>
              <input name="email" type="email" placeholder="maria@example.com" />
            </label>
            <label className="flex column" style={{ flex: 1 }}>
              <span>Telefono (opzionale)</span>
              <input name="phone" placeholder="3331234567" />
            </label>
          </div>
          <button type="submit" disabled={createInviteeMutation.isPending}>
            Aggiungi invitato
          </button>
        </form>

        <form className="grid" style={{ gap: "0.75rem" }} onSubmit={handleBulkSubmit}>
          <label className="flex column">
            <span>Incolla elenco (Nome;Cognome;Email)</span>
            <textarea
              rows={4}
              value={bulkInput}
              onChange={(event) => setBulkInput(event.target.value)}
              placeholder={`Mario;Rossi;mario@example.com\nLaura;Bianchi`}
            />
          </label>
          <button type="submit" className="secondary" disabled={createInviteeMutation.isPending}>
            Importa da testo
          </button>
        </form>

        <div className="grid" style={{ gap: "0.75rem" }}>
          <span>Carica Excel o CSV (colonne Nome, Cognome, Email, Telefono)</span>
          <div className="upload-area">
            <input
              type="file"
              accept=".csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={handleUploadFile}
              disabled={fileUploading}
            />
            <p style={{ marginTop: "0.5rem" }}>
              {fileUploading ? "Caricamento in corso..." : "Trascina un file o selezionalo"}
            </p>
            {uploadSummary && <small>{uploadSummary}</small>}
          </div>
        </div>
      </section>

      <section className="card">
        <h2>Elenco invitati</h2>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Email</th>
                <th>Stato</th>
                <th>Ingresso</th>
                <th>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {invitees.length === 0 && (
                <tr>
                  <td colSpan={5}>Nessun invitato disponibile. Aggiungi il primo tramite i moduli sopra.</td>
                </tr>
              )}
              {invitees.map((invitee) => (
                <tr key={invitee.id}>
                  <td>
                    <strong>
                      {invitee.firstName} {invitee.lastName}
                    </strong>
                    <br />
                    <small>ID: {invitee.token}</small>
                  </td>
                  <td>
                    {invitee.email ?? <em>—</em>}
                    <br />
                    {invitee.phone && <small>{invitee.phone}</small>}
                  </td>
                  <td>{renderStatus(invitee.status)}</td>
                  <td>
                    {invitee.checkedInAt ? (
                      <span>
                        {new Date(invitee.checkedInAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    ) : (
                      <span>—</span>
                    )}
                  </td>
                  <td>
                    <div className="actions">
                      <button type="button" className="secondary" onClick={() => handleDownloadQr(invitee)}>
                        Scarica QR
                      </button>
                      <button type="button" className="secondary" onClick={() => sendMutation.mutate(invitee.id)} disabled={sendMutation.isPending}>
                        Invia Email
                      </button>
                      {invitee.status === "CHECKED_IN" && (
                        <button type="button" onClick={() => resetMutation.mutate(invitee.id)}>
                          Segna come non entrato
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1rem" }}>
        <div className="card">
          <h2>Chi deve arrivare</h2>
          <ul>
            {pendingInvitees.map((invitee) => (
              <li key={invitee.id}>
                {invitee.firstName} {invitee.lastName}
              </li>
            ))}
            {pendingInvitees.length === 0 && <li>Tutti gli invitati sono arrivati!</li>}
          </ul>
        </div>
        <div className="card">
          <h2>Ingresso confermato</h2>
          <ul>
            {checkedInInvitees.map((invitee) => (
              <li key={invitee.id}>
                {invitee.firstName} {invitee.lastName} • {invitee.checkedInAt ? new Date(invitee.checkedInAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
              </li>
            ))}
            {checkedInInvitees.length === 0 && <li>Nessun ingresso registrato.</li>}
          </ul>
        </div>
      </section>
    </div>
  );
};

export default DashboardPage;
