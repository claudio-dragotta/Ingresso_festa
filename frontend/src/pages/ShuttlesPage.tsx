import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ShuttleAssignment, ShuttleBoardStatus, ShuttleDirection, ShuttleMachine, ShuttleSlot } from "../api/shuttles";
import { createAssignment, fetchAssignments, fetchShuttleConfig, fetchSlots, updateAssignmentStatus } from "../api/shuttles";
import { useAuth } from "../context/AuthContext";

const ShuttlesPage = () => {
  const { role } = useAuth();
  const qc = useQueryClient();
  const canWrite = role === "ADMIN" || role === "ORGANIZER" || role === "SHUTTLE";
  const canManage = role === "ADMIN" || role === "ORGANIZER";

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
      </div>

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

