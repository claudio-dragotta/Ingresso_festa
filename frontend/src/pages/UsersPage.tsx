import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createUser, deleteUser, fetchUsers, setUserActive, fetchUserLogs, fetchUserEventAccesses, resetUserPassword, setUserRole, type User, type UserRole, type UserLogsResponse } from "../api/auth";
import { listEvents } from "../api/events";
import { assignUserToEvent, removeUserFromEvent } from "../api/events";
import "./UsersPage.css";

const TOKEN_STORAGE_KEY = "ingresso-festa-token";
const ROLE_STORAGE_KEY = "ingresso-festa-role";

const getCurrentUserId = (): string | null => {
  try {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!token) return null;
    const payload = JSON.parse(atob(token.split(".")[1] ?? ""));
    return payload.userId ?? null;
  } catch {
    return null;
  }
};

const currentUserId = getCurrentUserId();

export default function UsersPage() {
  const qc = useQueryClient();
  const { data: users = [], isLoading } = useQuery<User[]>({ queryKey: ["users"], queryFn: fetchUsers });
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [drawerTab, setDrawerTab] = useState<"logs" | "feste" | "password">("logs");
  const [resetPwd, setResetPwd] = useState({ newPassword: "", confirm: "" });
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);

  const { data: selectedLogs } = useQuery<UserLogsResponse>({
    queryKey: ["user-logs", selectedUser?.id],
    queryFn: () => fetchUserLogs(selectedUser!.id),
    enabled: !!selectedUser && drawerTab === "logs",
  });

  const { data: allEvents = [] } = useQuery({
    queryKey: ["events"],
    queryFn: listEvents,
    enabled: !!selectedUser && drawerTab === "feste",
  });

  const { data: userAccesses = [], refetch: refetchAccesses } = useQuery({
    queryKey: ["user-event-accesses", selectedUser?.id],
    queryFn: () => fetchUserEventAccesses(selectedUser!.id),
    enabled: !!selectedUser && drawerTab === "feste",
  });

  const resetPwdMut = useMutation({
    mutationFn: () => resetUserPassword(selectedUser!.id, resetPwd.newPassword),
    onSuccess: () => {
      setResetPwd({ newPassword: "", confirm: "" });
      setResetError(null);
      setResetSuccess(true);
      setTimeout(() => setResetSuccess(false), 3000);
    },
    onError: (err: any) => {
      setResetError(err?.response?.data?.message ?? "Errore durante il reset");
    },
  });

  const assignMut = useMutation({
    mutationFn: ({ eventId, role }: { eventId: string; role: string }) =>
      assignUserToEvent(eventId, selectedUser!.id, role),
    onSuccess: () => refetchAccesses(),
  });

  const removeMut = useMutation({
    mutationFn: (eventId: string) => removeUserFromEvent(eventId, selectedUser!.id),
    onSuccess: () => refetchAccesses(),
  });

  const [newUser, setNewUser] = useState({ username: "", password: "", role: "ENTRANCE" as UserRole });

  const createMut = useMutation({
    mutationFn: () => createUser(newUser.username, newUser.password, newUser.role),
    onSuccess: () => {
      setNewUser({ username: "", password: "", role: "ENTRANCE" });
      qc.invalidateQueries({ queryKey: ["users"] });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteUser(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });

  const roleMut = useMutation({
    mutationFn: ({ id, role }: { id: string; role: UserRole }) => setUserRole(id, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });

  const activeMut = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => setUserActive(id, active),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["users"] });
      if (vars && vars.active === false) {
        const me = getCurrentUserId();
        if (me && vars.id === me) {
          try {
            localStorage.removeItem(TOKEN_STORAGE_KEY);
            localStorage.removeItem(ROLE_STORAGE_KEY);
          } catch {}
          if (typeof window !== "undefined") window.location.assign("/login");
        }
      }
    },
  });

  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return users;
    return users.filter(u => u.username.toLowerCase().includes(s));
  }, [users, search]);

  return (
    <div className="users-page">
      <div className="users-header">
        <div>
          <h1>Utenti</h1>
          <p className="subtitle">Gestisci accessi e ruoli</p>
        </div>
        <div className="search-box">
          <input
            type="search"
            placeholder="Cerca username..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="users-actions">
        <form className="new-user-form" onSubmit={(e) => { e.preventDefault(); createMut.mutate(); }}>
          <h3>Nuovo utente</h3>
          <div className="row">
            <input
              type="text"
              placeholder="Username"
              value={newUser.username}
              onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
              required
            />
            <input
              type="text"
              placeholder="Password"
              value={newUser.password}
              onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
              required
            />
            <select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value as UserRole })}>
              <option value="ENTRANCE">Ingresso</option>
              <option value="ORGANIZER">Organizzatore</option>
              <option value="SHUTTLE">Navetta</option>
              <option value="ADMIN">Admin</option>
            </select>
            <button type="submit" disabled={createMut.isPending}>Crea</button>
          </div>
        </form>
      </div>

      <div className="users-table">
        <div className="table-head">
          <div>Username</div>
          <div>Ruolo</div>
          <div>Stato</div>
          <div>Creato</div>
          <div className="right">Azioni</div>
        </div>
        {isLoading ? (
          <div className="loading">Caricamento...</div>
        ) : (
          filtered.map((u) => (
            <div key={u.id} className="table-row" onClick={() => setSelectedUser(u)} role="button">
              <div className="username">{u.username}</div>
              <div onClick={(e) => e.stopPropagation()}>
                {currentUserId === u.id ? (
                  <span className={`role-badge ${u.role.toLowerCase()}`}>
                    {u.role === "ADMIN" ? "Admin" : u.role === "ORGANIZER" ? "Organizzatore" : u.role === "SHUTTLE" ? "Navetta" : "Ingresso"}
                  </span>
                ) : (
                  <select
                    className="role-select"
                    value={u.role}
                    disabled={roleMut.isPending}
                    onChange={(e) => roleMut.mutate({ id: u.id, role: e.target.value as UserRole })}
                  >
                    <option value="ADMIN">Admin</option>
                    <option value="ORGANIZER">Organizzatore</option>
                    <option value="ENTRANCE">Ingresso</option>
                    <option value="SHUTTLE">Navetta</option>
                  </select>
                )}
              </div>
              <div>
                <span className={`status-badge ${u.active ? "active" : "inactive"}`}>{u.active ? "Attivo" : "Disattivo"}</span>
              </div>
              <div>{new Date(u.createdAt).toLocaleString()}</div>
              <div className="right actions">
                <button
                  type="button"
                  className={u.active ? "secondary" : "primary"}
                  onClick={(e) => { e.stopPropagation(); activeMut.mutate({ id: u.id, active: !u.active }); }}
                  disabled={activeMut.isPending}
                >
                  {u.active ? "Disattiva" : "Attiva"}
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={(e) => { e.stopPropagation(); if (confirm(`Eliminare utente ${u.username}?`)) deleteMut.mutate(u.id); }}
                  disabled={deleteMut.isPending}
                >
                  Elimina
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {selectedUser && (
        <div className="user-logs-drawer" role="dialog" aria-label="Dettaglio attività utente">
          <div className="drawer-header">
            <div className="drawer-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M20 21v-2a4 4 0 00-4-4h-8a4 4 0 00-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              <h3>{selectedUser.username}</h3>
            </div>
            <button className="close-btn" onClick={() => { setSelectedUser(null); setDrawerTab("logs"); setResetPwd({ newPassword: "", confirm: "" }); setResetError(null); setResetSuccess(false); }} aria-label="Chiudi">×</button>
          </div>

          <div className="drawer-tabs">
            <button className={drawerTab === "logs" ? "tab active" : "tab"} onClick={() => setDrawerTab("logs")}>Attività</button>
            {selectedUser.role !== "ADMIN" && (
              <button className={drawerTab === "feste" ? "tab active" : "tab"} onClick={() => setDrawerTab("feste")}>Accesso Feste</button>
            )}
            <button className={drawerTab === "password" ? "tab active" : "tab"} onClick={() => { setDrawerTab("password"); setResetError(null); setResetSuccess(false); }}>Password</button>
          </div>

          {drawerTab === "logs" && (
            <>
              <div className="drawer-stats">
                <div className="stat">
                  <span className="label">Ingressi autorizzati</span>
                  <span className="value">{selectedLogs?.enteredCount ?? 0}</span>
                </div>
                <div className="stat">
                  <span className="label">Log totali</span>
                  <span className="value">{selectedLogs?.total ?? 0}</span>
                </div>
              </div>
              <div className="logs-list">
                {selectedLogs?.logs?.length ? (
                  selectedLogs.logs.map((log) => (
                    <div key={log.id} className="log-row">
                      <div className={`badge outcome ${log.outcome.toLowerCase()}`}>{log.outcome}</div>
                      <div className="person">
                        {log.invitee ? (
                          <>
                            <strong>{log.invitee.lastName} {log.invitee.firstName}</strong>
                            <span className="meta">{log.invitee.listType}{log.invitee.paymentType ? ` • ${log.invitee.paymentType}` : ''}</span>
                          </>
                        ) : (
                          <em>N/D</em>
                        )}
                      </div>
                      <div className="message">{log.message || ''}</div>
                      <div className="time">{new Date(log.createdAt).toLocaleString()}</div>
                    </div>
                  ))
                ) : (
                  <div className="empty">Nessun log</div>
                )}
              </div>
            </>
          )}

          {drawerTab === "password" && (
            <div className="reset-password-form">
              <p className="reset-password-hint">Imposta una nuova password per <strong>{selectedUser.username}</strong>. L'utente dovrà usarla al prossimo accesso.</p>
              <form onSubmit={(e) => {
                e.preventDefault();
                setResetError(null);
                if (resetPwd.newPassword.length < 6) { setResetError("La password deve essere di almeno 6 caratteri"); return; }
                if (resetPwd.newPassword !== resetPwd.confirm) { setResetError("Le password non coincidono"); return; }
                resetPwdMut.mutate();
              }}>
                <div className="form-field">
                  <label>Nuova password</label>
                  <input type="password" placeholder="Minimo 6 caratteri" value={resetPwd.newPassword} onChange={(e) => setResetPwd(p => ({ ...p, newPassword: e.target.value }))} required />
                </div>
                <div className="form-field">
                  <label>Conferma password</label>
                  <input type="password" placeholder="Ripeti la password" value={resetPwd.confirm} onChange={(e) => setResetPwd(p => ({ ...p, confirm: e.target.value }))} required />
                </div>
                {resetError && <div className="reset-error">{resetError}</div>}
                {resetSuccess && <div className="reset-success">Password resettata con successo</div>}
                <button type="submit" className="primary" disabled={resetPwdMut.isPending}>
                  {resetPwdMut.isPending ? "Reset in corso..." : "Reset password"}
                </button>
              </form>
            </div>
          )}

          {drawerTab === "feste" && (
            <div className="event-access-list">
              {allEvents.length === 0 ? (
                <div className="empty">Nessuna festa disponibile</div>
              ) : (
                allEvents.map((event) => {
                  const access = userAccesses.find((a) => a.eventId === event.id);
                  return (
                    <div key={event.id} className="event-access-row">
                      <div className="event-access-name">{event.name}</div>
                      <select
                        value={access?.role ?? ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "") {
                            if (access) removeMut.mutate(event.id);
                          } else {
                            assignMut.mutate({ eventId: event.id, role: val });
                          }
                        }}
                        disabled={assignMut.isPending || removeMut.isPending}
                      >
                        <option value="">— Nessun accesso —</option>
                        <option value="ENTRANCE">Ingresso</option>
                        <option value="ORGANIZER">Organizzatore</option>
                        <option value="SHUTTLE">Navetta</option>
                      </select>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
