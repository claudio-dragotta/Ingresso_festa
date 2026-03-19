import apiClient from "./client";
import axios from "axios";
import type { Invitee, ListType } from "./invitees";

const BASE_URL = import.meta.env.VITE_API_URL ?? "";

export type PreRegStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface PreRegistration {
  id: string;
  eventId: string;
  firstName: string;
  lastName: string;
  email: string;
  listType: ListType;
  notes?: string | null;
  status: PreRegStatus;
  createdAt: string;
  updatedAt: string;
}

export interface EventInfo {
  id: string;
  name: string;
  status: string;
}

// ── Chiamate PUBBLICHE (no token) ────────────────────────────────────────────

export const fetchEventInfo = async (eventId: string): Promise<EventInfo> => {
  const res = await axios.get<EventInfo>(`${BASE_URL}/api/register/${eventId}/info`);
  return res.data;
};

export const submitPreRegistration = async (
  eventId: string,
  payload: { firstName: string; lastName: string; email: string; notes?: string }
): Promise<{ success: boolean }> => {
  const res = await axios.post<{ success: boolean }>(`${BASE_URL}/api/register/${eventId}`, payload);
  return res.data;
};

// ── Chiamate PROTETTE (richiedono token) ─────────────────────────────────────

export const fetchPreRegistrations = async (eventId: string): Promise<PreRegistration[]> => {
  const res = await apiClient.get<PreRegistration[]>(`/events/${eventId}/preregistrations`);
  return res.data;
};

export const approvePreRegistration = async (
  eventId: string,
  id: string,
  opts: { listType: ListType; paymentType?: string }
): Promise<{ success: boolean; invitee: Invitee }> => {
  const res = await apiClient.post(`/events/${eventId}/preregistrations/${id}/approve`, opts);
  return res.data;
};

export const rejectPreRegistration = async (eventId: string, id: string): Promise<{ success: boolean }> => {
  const res = await apiClient.post(`/events/${eventId}/preregistrations/${id}/reject`);
  return res.data;
};

export const deletePreRegistration = async (eventId: string, id: string): Promise<void> => {
  await apiClient.delete(`/events/${eventId}/preregistrations/${id}`);
};
