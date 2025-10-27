import apiClient from "./client";

interface LoginPayload {
  username: string;
  password: string;
}

export const loginRequest = async (payload: LoginPayload) => {
  const response = await apiClient.post<{ token: string }>("/auth/login", payload);
  return response.data.token;
};
