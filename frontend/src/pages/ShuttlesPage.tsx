import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ShuttleAssignment, ShuttleDirection, ShuttleMachine, ShuttleSlot } from "../api/shuttles";
import { createAssignment, fetchAssignments, fetchShuttleConfig, fetchSlots, updateAssignmentStatus, syncShuttlesFromSheets } from "../api/shuttles";
import { useAuth } from "../context/AuthContext";

const ShuttlesPage = () => {
  const { role } = useAuth();
  const qc = useQueryClient();
  const canWrite = role === "ADMIN" || role === "ORGANIZER" || role === "SHUTTLE";

  const [direction, setDirection] = useState<ShuttleDirection>("ANDATA");
  const { data: cfg } = useQuery({ queryKey: ["shuttle-config"], queryFn: fetchShuttleConfig });
  const { data: slots = [] } = useQuery<ShuttleSlot[]>({ queryKey: ["slots", direction], queryFn: () => fetchSlots(direction) });

  const [selectedTime, setSelectedTime] = useState<string | "ALL">("ALL");
  useEffect(() => { setSelectedTime("ALL"); }, [direction]);

  const { data: assignments = [] } = useQuery<ShuttleAssignment[]>({
    queryKey: ["assignments", direction, selectedTime],
    queryFn: () => fetchAssignments({ direction, time: selectedTime === "ALL" ? undefined : selectedTime }),
  });

  const machines: ShuttleMachine[] = useMemo(() => cfg?.machines ?? [], [cfg]);
  const times = useMemo(() => slots.map((s) => s.time), [slots]);

  const toggleMut = useMutation({
    mutationFn: (a: ShuttleAssignment) => updateAssignmentStatus(a.id, a.status === "BOARDED" ? "PENDING" : "BOARDED"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assignments"] }),
  });

  const addMut = useMutation({
    mutationFn: (payload: { direction: ShuttleDirection; time: string; machineId: string; fullName: string }) => createAssignment(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assignments"] });
      qc.invalidateQueries({ queryKey: ["slots"] });
    },
  });

  // Mutation per sincronizzazione da Google Sheets
  const [syncResult, setSyncResult] = useState<{
    success: boolean;
    message: string;
    stats?: { newImported: number; alreadyExists: number; deleted: number };
  } | null>(null);

  const syncMut = useMutation({
    mutationFn: () => syncShuttlesFromSheets(direction, false),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["assignments"] });
      qc.invalidateQueries({ queryKey: ["slots"] });
      setSyncResult({
        success: true,
        message: `Sincronizzazione ${direction} completata!`,
        stats: {
          newImported: data.newImported,
          alreadyExists: data.alreadyExists,
          deleted: data.deleted,
        },
      });
      setTimeout(() => setSyncResult(null), 8000);
    },
    onError: (err: any) => {
      setSyncResult({
        success: false,
        message: err?.response?.data?.message || `Errore sincronizzazione ${direction}`,
      });
      setTimeout(() => setSyncResult(null), 8000);
    },
  });

  // Form stato locale
  const [newName, setNewName] = useState("");
  const [newMachine, setNewMachine] = useState<string>("");
  const [newTime, setNewTime] = useState<string>("");
  useEffect(() => {
    setNewMachine(machines[0]?.id ?? "");
    setNewTime(times[0] ?? "");
  }, [machines, times, direction]);

  const grouped = useMemo(() => {
    const filterByTime = selectedTime === "ALL" ? assignments : assignments.filter(a => a.slot.time === selectedTime);
    const map = new Map<string, ShuttleAssignment[]>();
    for (const m of machines) map.set(m.id, []);
    for (const a of filterByTime) {
      const arr = map.get(a.machineId) || [];
      arr.push(a);
      map.set(a.machineId, arr);
    }
    return map;
  }, [assignments, machines, selectedTime]);

  return (
    <div className="users-page" style={{ minHeight: "100vh" }}>
      <div className="users-header">
        <div>
          <h1>Navette</h1>
          <p className="subtitle">Gestione andata/ritorno per fasce orarie e macchine</p>
        </div>
        <div style={{ display: "flex", gap: ".5rem", alignItems: "center", flexWrap: "wrap" }}>
          <div className="search-box" style={{ display: "flex", gap: ".5rem" }}>
            <select value={direction} onChange={(e) => setDirection(e.target.value as ShuttleDirection)}>
              <option value="ANDATA">Andata</option>
              <option value="RITORNO">Ritorno</option>
            </select>
            <select value={selectedTime} onChange={(e) => setSelectedTime(e.target.value)}>
              <option value="ALL">Tutte le fasce</option>
              {times.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          {canWrite && (
            <button
              onClick={() => syncMut.mutate()}
              disabled={syncMut.isPending}
              className="sync-button"
              style={{
                padding: "0.5rem 1rem",
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: syncMut.isPending ? "not-allowed" : "pointer",
                fontWeight: "600",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              {syncMut.isPending ? (
                <>
                  <span style={{ animation: "spin 1s linear infinite" }}>⟳</span>
                  Sincronizzazione...
                </>
              ) : (
                <>
                  <span>⟳</span>
                  Importa da Google Sheets
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Banner risultato sincronizzazione */}
      {syncResult && (
        <div
          style={{
            padding: "1rem",
            marginBottom: "1rem",
            borderRadius: "8px",
            background: syncResult.success ? "#d1fae5" : "#fee2e2",
            border: `1px solid ${syncResult.success ? "#10b981" : "#ef4444"}`,
            color: syncResult.success ? "#065f46" : "#991b1b",
          }}
        >
          <strong>{syncResult.message}</strong>
          {syncResult.stats && (
            <p style={{ marginTop: "0.5rem", fontSize: "0.9rem" }}>
              {syncResult.stats.newImported} nuove importate, {syncResult.stats.alreadyExists} già presenti
              {syncResult.stats.deleted > 0 && `, ${syncResult.stats.deleted} eliminate`}
            </p>
          )}
        </div>
      )}

      {canWrite && (
        <div className="users-actions">
          <form className="new-user-form" onSubmit={(e) => { e.preventDefault(); if (!newName.trim()) return; addMut.mutate({ direction, time: newTime || times[0], machineId: newMachine || machines[0]?.id!, fullName: newName.trim() }); setNewName(""); }}>
            <h3>Nuova assegnazione</h3>
            <div className="row">
              <input type="text" placeholder="Nome e Cognome" value={newName} onChange={(e) => setNewName(e.target.value)} required />
              <select value={newMachine} onChange={(e) => setNewMachine(e.target.value)}>
                {machines.map((m) => (<option key={m.id} value={m.id}>{m.name}</option>))}
              </select>
              <select value={newTime} onChange={(e) => setNewTime(e.target.value)}>
                {times.map((t) => (<option key={t} value={t}>{t}</option>))}
              </select>
              <button type="submit" disabled={addMut.isPending}>Aggiungi</button>
            </div>
          </form>
        </div>
      )}

      <div className="users-table">
        <div className="table-head">
          <div>Macchina</div>
          <div>Capienza (slot/macc.)</div>
          <div>Assegnati</div>
          <div>Azioni</div>
          <div className="right">Note</div>
        </div>
        {machines.map((m) => {
          const list = grouped.get(m.id) ?? [];
          return (
            <div key={m.id} className="table-row">
              <div className="username">{m.name}</div>
              <div>{cfg?.slotCapacity ?? 12} / {cfg?.machineCapacity ?? 4}</div>
              <div>
                <div style={{ display: "flex", gap: ".4rem", flexWrap: "wrap" }}>
                  {list.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      className={`status-badge ${a.status === "BOARDED" ? "active" : "inactive"}`}
                      onClick={() => canWrite && toggleMut.mutate(a)}
                      title={a.slot.time}
                    >
                      {a.fullName} ({a.slot.time})
                    </button>
                  ))}
                  {list.length === 0 && <span className="subtitle">Nessuno</span>}
                </div>
              </div>
              <div>-</div>
              <div className="right">&nbsp;</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ShuttlesPage;

