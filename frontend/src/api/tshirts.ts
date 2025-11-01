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

// GET /api/tshirts - Ottieni lista magliette (con ricerca opzionale)
export const fetchTshirts = async (search?: string): Promise<Tshirt[]> => {
  const params = search ? { search } : {};
  const response = await apiClient.get<Tshirt[]>("/tshirts", { params });
  return response.data;
};

// GET /api/tshirts/stats - Statistiche magliette (solo admin)
export const fetchTshirtStats = async (): Promise<TshirtStats> => {
  const response = await apiClient.get<TshirtStats>("/tshirts/stats");
  return response.data;
};

// POST /api/tshirts - Crea nuova maglietta (solo admin)
export const createTshirt = async (data: TshirtInput): Promise<Tshirt> => {
  const response = await apiClient.post<Tshirt>("/tshirts", data);
  return response.data;
};

// PATCH /api/tshirts/:id/toggle - Toggle consegna maglietta
export const toggleTshirtReceived = async (id: string): Promise<Tshirt> => {
  const response = await apiClient.patch<Tshirt>(`/tshirts/${id}/toggle`);
  return response.data;
};

// DELETE /api/tshirts/:id - Elimina maglietta (solo admin)
export const deleteTshirt = async (id: string): Promise<void> => {
  await apiClient.delete(`/tshirts/${id}`);
};

// POST /api/tshirts/sync - Sincronizza magliette da Google Sheets (solo admin)
export const syncTshirts = async (opts?: { pruneMissing?: boolean }): Promise<SyncResult> => {
  const response = await apiClient.post<SyncResult>("/tshirts/sync", opts ?? {});
  return response.data;
};

// PATCH /api/tshirts/:id - Aggiorna taglia e/o tipologia (solo admin)
export const updateTshirt = async (
  id: string,
  data: Partial<Pick<Tshirt, 'size' | 'type'>>
): Promise<Tshirt> => {
  const response = await apiClient.patch<Tshirt>(`/tshirts/${id}`, data);
  return response.data;
};
