import apiClient from "./client";

export type ListType = "PAGANTE" | "GREEN";
export type EventStatus = "ACTIVE" | "PAUSED" | "LOCKED";

export interface Invitee {
  id: string;
  firstName: string;
  lastName: string;
  listType: ListType;
  paymentType?: string | null; // Solo per PAGANTE: bonifico, paypal, contanti, p2p
  hasEntered: boolean; // true = entrato (rosso), false = non entrato (verde)
  checkedInAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InviteeInput {
  firstName: string;
  lastName: string;
  listType: ListType;
  paymentType?: string;
}

export interface DuplicateGroup {
  key: string;
  count: number;
  items: Invitee[];
}

export interface Stats {
  paganti: {
    total: number;
    entered: number;
    remaining: number;
  };
  green: {
    total: number;
    entered: number;
    remaining: number;
  };
  total: {
    total: number;
    entered: number;
    remaining: number;
  };
}

export interface DashboardMetrics {
  total: number;
  entered: number;
  notEntered: number;
  pagantiTotal: number;
  greenTotal: number;
  eventStatus: EventStatus;
}

export interface SystemConfig {
  id: number;
  eventName: string;
  eventStatus: EventStatus;
  updatedAt: string;
  createdAt: string;
}

export interface SyncResult {
  success: boolean;
  totalFromSheet: number;
  newImported: number;
  alreadyExists: number;
  errors: string[];
  duration: number;
  breakdown: {
    paganti: { imported: number; exists: number };
    green: { imported: number; exists: number };
  };
}

// GET /invitees - Lista tutti gli invitati
export const fetchInvitees = async () => {
  const response = await apiClient.get<Invitee[]>("/invitees");
  return response.data;
};

// GET /invitees/search?q=query - Ricerca invitati
export const searchInvitees = async (query: string) => {
  const response = await apiClient.get<Invitee[]>(`/invitees/search?q=${encodeURIComponent(query)}`);
  return response.data;
};

// GET /invitees/stats - Statistiche per i contatori
export const fetchStats = async () => {
  const response = await apiClient.get<Stats>("/invitees/stats");
  return response.data;
};

// POST /invitees - Crea nuovo invitato (o array di invitati)
export const createInvitee = async (payload: InviteeInput | InviteeInput[]) => {
  const response = await apiClient.post<Invitee | Invitee[]>("/invitees", payload);
  return response.data;
};

// POST /invitees/upload - Upload file (Excel/CSV)
export const uploadInviteesFile = async (file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  const response = await apiClient.post("/invitees/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data as { imported: number; skipped: number; total: number };
};

// POST /invitees/:id/checkin - Marca come entrato/non entrato
export const checkInPerson = async (inviteeId: string, adminOverride: boolean = false) => {
  const response = await apiClient.post<Invitee>(`/invitees/${inviteeId}/checkin`, { adminOverride });
  return response.data;
};

// PATCH /invitees/:id/reset - Reset check-in (solo admin)
export const resetInviteeCheckIn = async (inviteeId: string) => {
  const response = await apiClient.patch<Invitee>(`/invitees/${inviteeId}/reset`);
  return response.data;
};

// DELETE /invitees/:id - Elimina invitato (solo admin)
export const deleteInvitee = async (inviteeId: string) => {
  await apiClient.delete(`/invitees/${inviteeId}`);
};

// GET /dashboard/metrics - Metriche dashboard
export const fetchMetrics = async () => {
  const response = await apiClient.get<DashboardMetrics>("/dashboard/metrics");
  return response.data;
};

// GET /settings/state - Configurazione sistema
export const fetchSystemConfig = async () => {
  const response = await apiClient.get<SystemConfig | null>("/settings/state");
  return response.data;
};

// PATCH /settings/state - Aggiorna stato evento
export const updateEventStatus = async (status: EventStatus) => {
  const response = await apiClient.patch<SystemConfig>("/settings/state", { status });
  return response.data;
};

// POST /sync/google-sheets - Sincronizza con Google Sheets
export const syncGoogleSheets = async () => {
  const response = await apiClient.post<SyncResult>("/sync/google-sheets");
  return response.data;
};

// POST /sync/reset-and-reimport - Reset DB invitati + reimport da Google Sheets (admin)
export const resetAndReimport = async () => {
  const response = await apiClient.post<{ reset: { deletedInvitees: number; deletedLogs: number }; import: SyncResult }>(
    "/sync/reset-and-reimport",
  );
  return response.data;
};

// GET /invitees/duplicates - Gruppi di duplicati (solo admin)
export const fetchDuplicateInvitees = async () => {
  const response = await apiClient.get<DuplicateGroup[]>("/invitees/duplicates");
  return response.data;
};

export const promoteDuplicateGroup = async (key: string, paymentType?: string) => {
  const response = await apiClient.post<{ updated: number }>("/invitees/duplicates/promote", { key, paymentType });
  return response.data;
};

export const keepOneDuplicate = async (key: string, keepId: string) => {
  const response = await apiClient.post<{ deleted: number }>("/invitees/duplicates/keep-one", { key, keepId });
  return response.data;
};
