import apiClient from "./client";

export type ListType = "PAGANTE" | "GREEN";
export type EventStatus = "ACTIVE" | "PAUSED" | "LOCKED";

export interface Invitee {
  id: string;
  firstName: string;
  lastName: string;
  listType: ListType;
  paymentType?: string | null;
  email?: string | null;
  qrToken?: string | null;
  qrSentAt?: string | null;
  hasEntered: boolean;
  checkedInAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InviteeInput {
  firstName: string;
  lastName: string;
  listType: ListType;
  paymentType?: string;
  email?: string;
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

export interface ResetReimportResponse {
  reset: { deletedInvitees: number; deletedLogs: number; deletedTshirts: number };
  import: SyncResult;
  tshirts: SyncResult;
}

export const fetchInvitees = async (eventId: string) => {
  const response = await apiClient.get<Invitee[]>(`/events/${eventId}/invitees`);
  return response.data;
};

export const searchInvitees = async (eventId: string, query: string) => {
  const response = await apiClient.get<Invitee[]>(`/events/${eventId}/invitees/search?q=${encodeURIComponent(query)}`);
  return response.data;
};

export const fetchStats = async (eventId: string) => {
  const response = await apiClient.get<Stats>(`/events/${eventId}/invitees/stats`);
  return response.data;
};

export const createInvitee = async (eventId: string, payload: InviteeInput | InviteeInput[]) => {
  const response = await apiClient.post<Invitee | Invitee[]>(`/events/${eventId}/invitees`, payload);
  return response.data;
};

export const uploadInviteesFile = async (eventId: string, file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  const response = await apiClient.post(`/events/${eventId}/invitees/upload`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data as { imported: number; skipped: number; total: number };
};

export const checkInPerson = async (eventId: string, inviteeId: string, adminOverride: boolean = false) => {
  const response = await apiClient.post<Invitee>(`/events/${eventId}/invitees/${inviteeId}/checkin`, { adminOverride });
  return response.data;
};

export const resetInviteeCheckIn = async (eventId: string, inviteeId: string) => {
  const response = await apiClient.patch<Invitee>(`/events/${eventId}/invitees/${inviteeId}/reset`);
  return response.data;
};

export const deleteInvitee = async (eventId: string, inviteeId: string) => {
  await apiClient.delete(`/events/${eventId}/invitees/${inviteeId}`);
};

export const fetchMetrics = async (eventId: string) => {
  const response = await apiClient.get<DashboardMetrics>(`/events/${eventId}/dashboard/metrics`);
  return response.data;
};

export const fetchSystemConfig = async (eventId: string) => {
  const response = await apiClient.get<SystemConfig | null>(`/events/${eventId}/settings/state`);
  return response.data;
};

export const updateEventStatus = async (eventId: string, status: EventStatus) => {
  const response = await apiClient.patch<SystemConfig>(`/events/${eventId}/settings/state`, { status });
  return response.data;
};

export const syncGoogleSheets = async (eventId: string, opts?: { pruneMissing?: boolean }) => {
  const response = await apiClient.post<any>(`/events/${eventId}/sync/google-sheets`, opts ?? {});
  const raw = response.data as any;
  if (raw && typeof raw === 'object' && raw.data && typeof raw.data === 'object') {
    const flat: SyncResult = {
      success: Boolean(raw.success ?? raw.data.success ?? false),
      totalFromSheet: Number(raw.data.totalFromSheet ?? 0),
      newImported: Number(raw.data.newImported ?? 0),
      alreadyExists: Number(raw.data.alreadyExists ?? 0),
      errors: Array.isArray(raw.data.errors) ? raw.data.errors : [],
      duration: Number(raw.data.duration ?? 0),
      breakdown: raw.data.breakdown ?? { paganti: { imported: 0, exists: 0 }, green: { imported: 0, exists: 0 } },
    };
    return flat;
  }
  return raw as SyncResult;
};

export const resetAndReimport = async (eventId: string) => {
  const response = await apiClient.post<ResetReimportResponse>(`/events/${eventId}/sync/reset-and-reimport`);
  return response.data;
};

export const fetchDuplicateInvitees = async (eventId: string) => {
  const response = await apiClient.get<DuplicateGroup[]>(`/events/${eventId}/invitees/duplicates`);
  return response.data;
};

export const promoteDuplicateGroup = async (eventId: string, key: string, paymentType?: string) => {
  const response = await apiClient.post<{ updated: number }>(`/events/${eventId}/invitees/duplicates/promote`, { key, paymentType });
  return response.data;
};

export const keepOneDuplicate = async (eventId: string, key: string, keepId: string) => {
  const response = await apiClient.post<{ deleted: number }>(`/events/${eventId}/invitees/duplicates/keep-one`, { key, keepId });
  return response.data;
};

export const updateInviteeEmail = async (eventId: string, inviteeId: string, email: string | null) => {
  const response = await apiClient.patch<Invitee>(`/events/${eventId}/invitees/${inviteeId}/email`, { email });
  return response.data;
};

export const sendQrToInvitee = async (eventId: string, inviteeId: string) => {
  const response = await apiClient.post<{ success: boolean; email: string }>(`/events/${eventId}/invitees/${inviteeId}/send-qr`);
  return response.data;
};

export const sendQrBulk = async (eventId: string) => {
  const response = await apiClient.post<{ sent: number; failed: number; skipped: number }>(`/events/${eventId}/invitees/send-qr-bulk`);
  return response.data;
};

export const qrCheckin = async (eventId: string, token: string) => {
  const response = await apiClient.post<Invitee>(`/events/${eventId}/invitees/qr/checkin`, { token });
  return response.data;
};
