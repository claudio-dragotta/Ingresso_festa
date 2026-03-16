import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ShuttleAssignment, ShuttleDirection, ShuttleMachine, ShuttleSlot } from "../api/shuttles";
import { createAssignment, fetchAssignments, fetchShuttleConfig, fetchSlots, updateAssignmentStatus, syncShuttlesFromSheets, deleteSlot } from "../api/shuttles";
import { useAuth } from "../context/AuthContext";
import { useEvent } from "../context/EventContext";
import "./ShuttlesPage.css";

const ShuttlesPage = () => {
  const { role } = useAuth();
  const { currentEvent } = useEvent();
  const eventId = currentEvent!.id;
  const qc = useQueryClient();
  const canWrite = role === "ADMIN" || role === "ORGANIZER" || role === "SHUTTLE";
  const canManageSlots = role === "ADMIN" || role === "ORGANIZER";
  const isAdmin = role === "ADMIN";

  const [direction, setDirection] = useState<ShuttleDirection>("ANDATA");
  const { data: cfg } = useQuery({ queryKey: ["shuttle-config", eventId], queryFn: () => fetchShuttleConfig(eventId) });
  const { data: slots = [] } = useQuery<ShuttleSlot[]>({ queryKey: ["slots", eventId, direction], queryFn: () => fetchSlots(eventId, direction) });

  const [selectedTime, setSelectedTime] = useState<string | "ALL">("ALL");
  useEffect(() => { setSelectedTime("ALL"); }, [direction]);

  const { data: assignments = [] } = useQuery<ShuttleAssignment[]>({
    queryKey: ["assignments", eventId, direction, selectedTime],
    queryFn: () => fetchAssignments(eventId, { direction, time: selectedTime === "ALL" ? undefined : selectedTime }),
  });

  const machines: ShuttleMachine[] = useMemo(() => cfg?.machines ?? [], [cfg]);
  const times = useMemo(() => {
    const toMinutes = (t: string) => {
      const [h, m] = t.split(":").map(Number);
      return (h * 60) + m;
    };

    const uniqueTimes = Array.from(new Set(slots.map((s) => s.time)));

    const anchorTime = direction === "ANDATA" ? cfg?.outbound?.from : cfg?.return?.from;
    const anchorMinutes = anchorTime ? toMinutes(anchorTime) : 0;

    return uniqueTimes.sort((a, b) => {
      const am = toMinutes(a);
      const bm = toMinutes(b);
      if (anchorTime) {
        const ka = (am - anchorMinutes + 1440) % 1440;
        const kb = (bm - anchorMinutes + 1440) % 1440;
        return ka - kb;
      }
      return am - bm;
    });
  }, [slots, cfg, direction]);

  const toggleMut = useMutation({
    mutationFn: (a: ShuttleAssignment) => updateAssignmentStatus(eventId, a.id, a.status === "BOARDED" ? "PENDING" : "BOARDED"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assignments", eventId] }),
  });

  const addMut = useMutation({
    mutationFn: (payload: { direction: ShuttleDirection; time: string; machineId: string; fullName: string }) => createAssignment(eventId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assignments", eventId] });
      qc.invalidateQueries({ queryKey: ["slots", eventId] });
    },
  });

  const [syncResult, setSyncResult] = useState<{
    success: boolean;
    message: string;
    stats?: { newImported: number; alreadyExists: number; deleted: number };
  } | null>(null);

  const syncMut = useMutation({
    mutationFn: () => syncShuttlesFromSheets(eventId, direction, false),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["assignments", eventId] });
      qc.invalidateQueries({ queryKey: ["slots", eventId] });
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

  const syncBothMut = useMutation({
    mutationFn: async () => {
      const [outRes, retRes] = await Promise.all([
        syncShuttlesFromSheets(eventId, "ANDATA", false),
        syncShuttlesFromSheets(eventId, "RITORNO", false),
      ]);
      return { outRes, retRes };
    },
    onSuccess: ({ outRes, retRes }) => {
      qc.invalidateQueries({ queryKey: ["assignments", eventId] });
      qc.invalidateQueries({ queryKey: ["slots", eventId] });
      setSyncResult({
        success: true,
        message: "Sincronizzazione Andata + Ritorno completata!",
        stats: {
          newImported: (outRes?.newImported ?? 0) + (retRes?.newImported ?? 0),
          alreadyExists: (outRes?.alreadyExists ?? 0) + (retRes?.alreadyExists ?? 0),
          deleted: (outRes?.deleted ?? 0) + (retRes?.deleted ?? 0),
        },
      });
      setTimeout(() => setSyncResult(null), 8000);
    },
    onError: (err: any) => {
      setSyncResult({
        success: false,
        message: err?.response?.data?.message || "Errore sincronizzazione Andata+Ritorno",
      });
      setTimeout(() => setSyncResult(null), 8000);
    },
  });

  const syncPruneMut = useMutation({
    mutationFn: () => syncShuttlesFromSheets(eventId, direction, true),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["assignments", eventId] });
      qc.invalidateQueries({ queryKey: ["slots", eventId] });
      setSyncResult({
        success: true,
        message: `Allineamento ${direction} completato (sovrascrive)!`,
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
        message: err?.response?.data?.message || `Errore allineamento ${direction}`,
      });
      setTimeout(() => setSyncResult(null), 8000);
    },
  });

  const syncBothPruneMut = useMutation({
    mutationFn: async () => {
      const [outRes, retRes] = await Promise.all([
        syncShuttlesFromSheets(eventId, "ANDATA", true),
        syncShuttlesFromSheets(eventId, "RITORNO", true),
      ]);
      return { outRes, retRes };
    },
    onSuccess: ({ outRes, retRes }) => {
      qc.invalidateQueries({ queryKey: ["assignments", eventId] });
      qc.invalidateQueries({ queryKey: ["slots", eventId] });
      setSyncResult({
        success: true,
        message: "Allineamento Andata + Ritorno completato (sovrascrive)!",
        stats: {
          newImported: (outRes?.newImported ?? 0) + (retRes?.newImported ?? 0),
          alreadyExists: (outRes?.alreadyExists ?? 0) + (retRes?.alreadyExists ?? 0),
          deleted: (outRes?.deleted ?? 0) + (retRes?.deleted ?? 0),
        },
      });
      setTimeout(() => setSyncResult(null), 8000);
    },
    onError: (err: any) => {
      setSyncResult({
        success: false,
        message: err?.response?.data?.message || "Errore allineamento Andata+Ritorno",
      });
      setTimeout(() => setSyncResult(null), 8000);
    },
  });

  const deleteSlotMut = useMutation({
    mutationFn: (time: string) => deleteSlot(eventId, direction, time),
    onSuccess: (_, time) => {
      qc.invalidateQueries({ queryKey: ["slots", eventId] });
      qc.invalidateQueries({ queryKey: ["assignments", eventId] });
      setSyncResult({
        success: true,
        message: `Slot ${time} eliminato con successo`,
      });
      setTimeout(() => setSyncResult(null), 5000);
    },
    onError: (err: any, time) => {
      setSyncResult({
        success: false,
        message: err?.response?.data?.message || `Errore eliminazione slot ${time}`,
      });
      setTimeout(() => setSyncResult(null), 5000);
    },
  });

  const [newName, setNewName] = useState("");
  const [newMachine, setNewMachine] = useState<string>("");
  const [newTime, setNewTime] = useState<string>("");
  useEffect(() => {
    setNewMachine(machines[0]?.id ?? "");
    setNewTime(times[0] ?? "");
  }, [machines, times, direction]);

  const grouped = useMemo(() => {
    const filterByTime = selectedTime === "ALL" ? assignments : assignments.filter(a => a.slot.time === selectedTime);
    const map = new Map<string, Map<string, ShuttleAssignment[]>>();

    for (const m of machines) {
      const timeMap = new Map<string, ShuttleAssignment[]>();
      for (const t of times) {
        timeMap.set(t, []);
      }
      map.set(m.id, timeMap);
    }

    for (const a of filterByTime) {
      const timeMap = map.get(a.machineId);
      if (timeMap) {
        const arr = timeMap.get(a.slot.time) || [];
        arr.push(a);
        timeMap.set(a.slot.time, arr);
      }
    }
    return map;
  }, [assignments, machines, selectedTime, times]);

  const getOccupancyLevel = (count: number, max: number) => {
    if (count === 0) return "low";
    if (count >= max) return "full";
    if (count / max >= 0.75) return "high";
    if (count / max >= 0.5) return "medium";
    return "low";
  };

  return (
    <div className="shuttles-page">
      <div className="shuttles-header">
        <h1>Navette</h1>
        <p className="subtitle">Gestione trasporti per andata e ritorno</p>
      </div>

      <div className="shuttles-controls">
        <div className="control-group">
          <label>Direzione</label>
          <select value={direction} onChange={(e) => setDirection(e.target.value as ShuttleDirection)}>
            <option value="ANDATA">Andata</option>
            <option value="RITORNO">Ritorno</option>
          </select>
        </div>
        <div className="control-group">
          <label>Fascia oraria</label>
          <select value={selectedTime} onChange={(e) => setSelectedTime(e.target.value)}>
            <option value="ALL">Tutte le fasce</option>
            {times.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        {isAdmin && (
          <button
            onClick={() => syncMut.mutate()}
            disabled={syncMut.isPending}
            className="sync-button"
          >
            {syncMut.isPending ? (
              <>
                <span style={{ animation: "spin 1s linear infinite" }}>⟳</span>
                Sincronizzazione...
              </>
            ) : (
              <>
                <span>⟳</span>
                Importa da Sheets
              </>
            )}
          </button>
        )}
        {isAdmin && (
          <button
            onClick={() => {
              if (confirm(`Allineare ${direction} al foglio? Verranno rimossi elementi non presenti nel foglio.`)) {
                syncPruneMut.mutate();
              }
            }}
            disabled={syncPruneMut.isPending}
            className="sync-button"
            title={`Allinea ${direction} (sovrascrive con foglio)`}
          >
            {syncPruneMut.isPending ? (
              <>
                <span style={{ animation: "spin 1s linear infinite" }}>⟳</span>
                Allineamento...
              </>
            ) : (
              <>
                <span>⤳</span>
                Allinea {direction}
              </>
            )}
          </button>
        )}
        {isAdmin && (
          <button
            onClick={() => syncBothMut.mutate()}
            disabled={syncBothMut.isPending}
            className="sync-button"
            title="Importa sia Andata che Ritorno"
          >
            {syncBothMut.isPending ? (
              <>
                <span style={{ animation: "spin 1s linear infinite" }}>⟳</span>
                Sincronizzo A+R...
              </>
            ) : (
              <>
                <span>⟲</span>
                Importa Andata+Ritorno
              </>
            )}
          </button>
        )}
        {isAdmin && (
          <button
            onClick={() => {
              if (confirm('Allineare Andata e Ritorno al foglio? Verranno rimossi elementi non presenti nel foglio.')) {
                syncBothPruneMut.mutate();
              }
            }}
            disabled={syncBothPruneMut.isPending}
            className="sync-button"
            title="Allinea Andata+Ritorno (sovrascrive)"
          >
            {syncBothPruneMut.isPending ? (
              <>
                <span style={{ animation: "spin 1s linear infinite" }}>⟳</span>
                Allineo A+R...
              </>
            ) : (
              <>
                <span>⤴</span>
                Allinea Andata+Ritorno
              </>
            )}
          </button>
        )}
        {canWrite && (
          <button
            onClick={() => syncBothMut.mutate()}
            disabled={syncBothMut.isPending}
            className="sync-button"
            title="Importa sia Andata che Ritorno"
          >
            {syncBothMut.isPending ? (
              <>
                <span style={{ animation: "spin 1s linear infinite" }}>⟳</span>
                Sincronizzo A+R...
              </>
            ) : (
              <>
                <span>⟲</span>
                Importa Andata+Ritorno
              </>
            )}
          </button>
        )}
      </div>

      {syncResult && (
        <div className={`sync-banner ${syncResult.success ? "success" : "error"}`}>
          <strong>{syncResult.message}</strong>
          {syncResult.stats && (
            <p>
              {syncResult.stats.newImported} nuove, {syncResult.stats.alreadyExists} esistenti
              {syncResult.stats.deleted > 0 && `, ${syncResult.stats.deleted} eliminate`}
            </p>
          )}
        </div>
      )}

      {canWrite && (
        <div className="add-assignment-card">
          <h3>Aggiungi assegnazione</h3>
          <form
            className="add-assignment-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!newName.trim()) return;
              addMut.mutate({
                direction,
                time: newTime || times[0],
                machineId: newMachine || machines[0]?.id!,
                fullName: newName.trim(),
              });
              setNewName("");
            }}
          >
            <div className="form-field">
              <label htmlFor="name">Nome e Cognome</label>
              <input
                id="name"
                type="text"
                placeholder="Es. Mario Rossi"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
              />
            </div>
            <div className="form-field">
              <label htmlFor="machine">Macchina</label>
              <select id="machine" value={newMachine} onChange={(e) => setNewMachine(e.target.value)}>
                {machines.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="time">Orario</label>
              <select id="time" value={newTime} onChange={(e) => setNewTime(e.target.value)}>
                {times.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <button type="submit" disabled={addMut.isPending}>
              {addMut.isPending ? "..." : "Aggiungi"}
            </button>
          </form>
        </div>
      )}

      {selectedTime !== "ALL" && (
        <div className="filter-info">
          Mostrando solo fascia oraria: <strong>{selectedTime}</strong>
        </div>
      )}

      <div className="shuttles-grid">
        {machines.map((m) => {
          const timeMap = grouped.get(m.id);
          if (!timeMap) return null;

          const allAssignments = Array.from(timeMap.values()).flat();
          const totalOccupied = allAssignments.length;
          const maxCapacity = (selectedTime === "ALL" ? times.length : 1) * (cfg?.machineCapacity ?? 4);

          return (
            <div key={m.id} className="machine-card">
              <div className="machine-header">
                <div className="machine-name">
                  <div className="machine-icon">{m.name.match(/\d+/)?.[0] ?? "M"}</div>
                  <span>{m.name}</span>
                </div>
                <div className="machine-stats">
                  <div className="stat-item">
                    <div className="stat-label">Occupati</div>
                    <div className="stat-value">{totalOccupied}</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-label">Posti totali</div>
                    <div className="stat-value">{maxCapacity}</div>
                  </div>
                </div>
              </div>

              <div className="time-slots">
                {(selectedTime === "ALL" ? times : [selectedTime]).map((time) => {
                  const assignmentsList = timeMap.get(time) ?? [];
                  const occupancy = assignmentsList.length;
                  const capacity = cfg?.machineCapacity ?? 4;
                  const level = getOccupancyLevel(occupancy, capacity);

                  return (
                    <div key={time} className="time-slot-card">
                      <div className="time-slot-header">
                        <div className="time-slot-time">{time}</div>
                        <div className="time-slot-actions">
                          <div className={`occupancy-badge ${level}`}>
                            {occupancy}/{capacity}
                          </div>
                          {canManageSlots && (
                            <button
                              className="delete-slot-button"
                              onClick={() => {
                                if (confirm(`Eliminare lo slot ${time}? Verranno eliminate anche tutte le assegnazioni per questo orario e la colonna dal foglio Google Sheets.`)) {
                                  deleteSlotMut.mutate(time);
                                }
                              }}
                              disabled={deleteSlotMut.isPending}
                              title={`Elimina slot ${time}`}
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="assignments-list">
                        {assignmentsList.length > 0 ? (
                          assignmentsList.map((a) => (
                            <div
                              key={a.id}
                              className={`assignment-item ${a.status === "BOARDED" ? "boarded" : ""}`}
                              onClick={() => canWrite && toggleMut.mutate(a)}
                              title={a.status === "BOARDED" ? "Salito - clicca per annullare" : "In attesa - clicca per marcare come salito"}
                            >
                              <span className="assignment-name">{a.fullName}</span>
                              <span className="assignment-status">
                                {a.status === "BOARDED" ? "✓" : "○"}
                              </span>
                            </div>
                          ))
                        ) : (
                          <div className="empty-slot">Nessuna assegnazione</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ShuttlesPage;
