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
  createdAt: string;
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
