import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createUser, deleteUser, fetchUsers, setUserActive, type User, type UserRole } from "../api/auth";
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

export default function UsersPage() {
  const qc = useQueryClient();
  const { data: users = [], isLoading } = useQuery<User[]>({ queryKey: ["users"], queryFn: fetchUsers });

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
            <div key={u.id} className="table-row">
              <div className="username">{u.username}</div>
              <div>
                <span className={`role-badge ${u.role.toLowerCase()}`}>{u.role === "ADMIN" ? "Admin" : "Ingresso"}</span>
              </div>
              <div>
                <span className={`status-badge ${u.active ? "active" : "inactive"}`}>{u.active ? "Attivo" : "Disattivo"}</span>
              </div>
              <div>{new Date(u.createdAt).toLocaleString()}</div>
              <div className="right actions">
                <button
                  type="button"
                  className={u.active ? "secondary" : "primary"}
                  onClick={() => activeMut.mutate({ id: u.id, active: !u.active })}
                  disabled={activeMut.isPending}
                >
                  {u.active ? "Disattiva" : "Attiva"}
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={() => { if (confirm(`Eliminare utente ${u.username}?`)) deleteMut.mutate(u.id); }}
                  disabled={deleteMut.isPending}
                >
                  Elimina
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
