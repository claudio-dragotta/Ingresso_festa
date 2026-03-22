import apiClient from "./client";

export type UserRole = "ADMIN" | "ENTRANCE" | "ORGANIZER" | "SHUTTLE";

interface LoginPayload {
  username: string;
  password: string;
}

interface LoginResponse {
  token: string;
  role: UserRole;
}

export interface User {
  id: string;
  username: string;
  role: UserRole;
  active: boolean;
  createdAt: string;
}

export interface UserLogItem {
  id: string;
  outcome: 'SUCCESS' | 'DUPLICATE' | 'BLOCKED';
  message?: string | null;
  createdAt: string;
  invitee?: {
    id: string;
    firstName: string;
    lastName: string;
    listType: 'PAGANTE' | 'GREEN';
    paymentType?: string | null;
  } | null;
}

export interface UserLogsResponse {
  total: number;
  enteredCount: number;
  logs: UserLogItem[];
}

// POST /auth/login - Login utente
export const loginRequest = async (payload: LoginPayload): Promise<LoginResponse> => {
  const response = await apiClient.post<LoginResponse>("/auth/login", payload);
  return response.data;
};

// POST /users - Crea nuovo utente (solo admin)
export const createUser = async (username: string, password: string, role: UserRole = "ENTRANCE") => {
  const response = await apiClient.post<User>("/users", { username, password, role });
  return response.data;
};

// GET /users - Lista utenti (solo admin)
export const fetchUsers = async () => {
  const response = await apiClient.get<User[]>("/users");
  return response.data;
};

// DELETE /users/:id - Elimina utente (solo admin)
export const deleteUser = async (userId: string) => {
  await apiClient.delete(`/users/${userId}`);
};

// PATCH /users/:id - Aggiorna stato attivo
export const setUserActive = async (userId: string, active: boolean) => {
  const response = await apiClient.patch<User>(`/users/${userId}`, { active });
  return response.data;
};

// GET /users/:id/logs - Log di check-in per utente (solo admin)
export const fetchUserLogs = async (userId: string): Promise<UserLogsResponse> => {
  const response = await apiClient.get<UserLogsResponse>(`/users/${userId}/logs`);
  return response.data;
};

export interface UserEventAccess {
  id: string;
  userId: string;
  eventId: string;
  role: UserRole;
  event: { id: string; name: string; date?: string | null; status: string };
}

// GET /users/:id/event-accesses - Feste a cui l'utente ha accesso
export const fetchUserEventAccesses = async (userId: string): Promise<UserEventAccess[]> => {
  const response = await apiClient.get<UserEventAccess[]>(`/users/${userId}/event-accesses`);
  return response.data;
};

// PATCH /users/:id/role - Admin cambia il ruolo di un utente
export const setUserRole = async (userId: string, role: UserRole): Promise<User> => {
  const response = await apiClient.patch<User>(`/users/${userId}/role`, { role });
  return response.data;
};

// PATCH /users/:id/reset-password - Admin resetta la password di un utente
export const resetUserPassword = async (userId: string, newPassword: string): Promise<void> => {
  await apiClient.patch(`/users/${userId}/reset-password`, { newPassword });
};

// POST /auth/change-password - Utente loggato cambia la propria password
export const changePassword = async (oldPassword: string, newPassword: string): Promise<void> => {
  await apiClient.post("/auth/change-password", { oldPassword, newPassword });
};
