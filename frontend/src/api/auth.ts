import apiClient from "./client";

export type UserRole = "ADMIN" | "ENTRANCE";

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

// POST /auth/users - Crea nuovo utente (solo admin)
export const createUser = async (username: string, password: string, role: UserRole = "ENTRANCE") => {
  const response = await apiClient.post<User>("/auth/users", { username, password, role });
  return response.data;
};

// GET /auth/users - Lista utenti (solo admin)
export const fetchUsers = async () => {
  const response = await apiClient.get<User[]>("/auth/users");
  return response.data;
};

// DELETE /auth/users/:id - Elimina utente (solo admin)
export const deleteUser = async (userId: string) => {
  await apiClient.delete(`/auth/users/${userId}`);
};

// PATCH /auth/users/:id - Aggiorna stato attivo
export const setUserActive = async (userId: string, active: boolean) => {
  const response = await apiClient.patch<User>(`/auth/users/${userId}`, { active });
  return response.data;
};

// GET /auth/users/:id/logs - Log di check-in per utente (solo admin)
export const fetchUserLogs = async (userId: string): Promise<UserLogsResponse> => {
  const response = await apiClient.get<UserLogsResponse>(`/auth/users/${userId}/logs`);
  return response.data;
};
