import apiClient from "./client";

export interface Tshirt {
  id: string;
  firstName: string;
  lastName: string;
  size: string;
  type: string;
  hasReceived: boolean;
  receivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TshirtInput {
  firstName: string;
  lastName: string;
  size: string;
  type: string;
}

export interface TshirtStats {
  total: number;
  received: number;
  pending: number;
  bySizeAndType: Record<string, { total: number; received: number; pending: number }>;
}

export interface SyncResult {
  success: boolean;
  newImported: number;
  alreadyExists: number;
}

export const fetchTshirts = async (eventId: string, search?: string): Promise<Tshirt[]> => {
  const params = search ? { search } : {};
  const response = await apiClient.get<Tshirt[]>(`/events/${eventId}/tshirts`, { params });
  return response.data;
};

export const fetchTshirtStats = async (eventId: string): Promise<TshirtStats> => {
  const response = await apiClient.get<TshirtStats>(`/events/${eventId}/tshirts/stats`);
  return response.data;
};

export const createTshirt = async (eventId: string, data: TshirtInput): Promise<Tshirt> => {
  const response = await apiClient.post<Tshirt>(`/events/${eventId}/tshirts`, data);
  return response.data;
};

export const toggleTshirtReceived = async (eventId: string, id: string): Promise<Tshirt> => {
  const response = await apiClient.patch<Tshirt>(`/events/${eventId}/tshirts/${id}/toggle`);
  return response.data;
};

export const deleteTshirt = async (eventId: string, id: string): Promise<void> => {
  await apiClient.delete(`/events/${eventId}/tshirts/${id}`);
};

export const syncTshirts = async (eventId: string, opts?: { pruneMissing?: boolean }): Promise<SyncResult> => {
  const response = await apiClient.post<SyncResult>(`/events/${eventId}/tshirts/sync`, opts ?? {});
  return response.data;
};

export const updateTshirt = async (
  eventId: string,
  id: string,
  data: Partial<Pick<Tshirt, 'size' | 'type'>>
): Promise<Tshirt> => {
  const response = await apiClient.patch<Tshirt>(`/events/${eventId}/tshirts/${id}`, data);
  return response.data;
};
