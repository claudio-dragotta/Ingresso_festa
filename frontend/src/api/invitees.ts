import apiClient from "./client";

export type InviteeStatus = "PENDING" | "CHECKED_IN" | "CANCELLED";

export interface Invitee {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  token: string;
  qrFilename: string;
  qrMimeType?: string | null;
  status: InviteeStatus;
  checkInCount: number;
  checkedInAt?: string | null;
  lastSentAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InviteeInput {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
}

export interface DashboardMetrics {
  total: number;
  checkedIn: number;
  pending: number;
  cancelled: number;
  eventStatus: EventStatus;
}

export type EventStatus = "ACTIVE" | "PAUSED" | "LOCKED";

export interface SystemConfig {
  id: number;
  eventName: string;
  eventStatus: EventStatus;
  updatedAt: string;
  createdAt: string;
}

export const fetchInvitees = async () => {
  const response = await apiClient.get<Invitee[]>("/invitees");
  return response.data;
};

export const createInvitee = async (payload: InviteeInput | InviteeInput[]) => {
  const response = await apiClient.post<Invitee | Invitee[]>("/invitees", payload);
  return response.data;
};

export const uploadInviteesFile = async (file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  const response = await apiClient.post("/invitees/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data as { imported: number; skipped: number; total: number };
};

export const resetInviteeCheckIn = async (inviteeId: string) => {
  const response = await apiClient.patch<Invitee>(`/invitees/${inviteeId}/reset`);
  return response.data;
};

export const sendInviteeQr = async (inviteeId: string) => {
  const response = await apiClient.post(`/invitees/${inviteeId}/send`);
  return response.data;
};

export const downloadInviteeQr = async (inviteeId: string) => {
  const response = await apiClient.get(`/invitees/${inviteeId}/qr`, {
    responseType: "blob",
  });
  return response.data as Blob;
};

export const fetchMetrics = async () => {
  const response = await apiClient.get<DashboardMetrics>("/dashboard/metrics");
  return response.data;
};

export const fetchSystemConfig = async () => {
  const response = await apiClient.get<SystemConfig | null>("/settings/state");
  return response.data;
};

export const updateEventStatus = async (status: EventStatus) => {
  const response = await apiClient.patch<SystemConfig>("/settings/state", { status });
  return response.data;
};

export const checkInToken = async (token: string) => {
  const response = await apiClient.post<{ invitee: Invitee; message: string }>("/checkin", { token });
  return response.data;
};

export interface SyncResult {
  success: boolean;
  message: string;
  data: {
    totalFromSheet: number;
    newImported: number;
    alreadyExists: number;
    errors: string[];
    duration: number;
  };
}

export const syncGoogleSheets = async () => {
  const response = await apiClient.post<SyncResult>("/sync/google-sheets");
  return response.data;
};
