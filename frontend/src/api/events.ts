import apiClient from "./client";
import type { EventInfo, EventModule } from "../context/EventContext";

export interface EventUser {
  id: string;
  userId: string;
  eventId: string;
  role: string;
  user: { id: string; username: string; active: boolean };
}

export const listEvents = async (): Promise<EventInfo[]> => {
  const { data } = await apiClient.get("/events");
  return data;
};

export const createEvent = async (payload: {
  name: string;
  date?: string;
  modules: EventModule[];
  createSheet?: boolean;
}): Promise<EventInfo> => {
  const { data } = await apiClient.post("/events", payload);
  return data;
};

export const updateEvent = async (
  eventId: string,
  payload: Partial<{ name: string; date: string | null; modules: EventModule[]; status: string; googleSheetId: string | null }>
): Promise<EventInfo> => {
  const { data } = await apiClient.patch(`/events/${eventId}`, payload);
  return data;
};

export const deleteEvent = async (eventId: string): Promise<void> => {
  await apiClient.delete(`/events/${eventId}`);
};

export const listEventUsers = async (eventId: string): Promise<EventUser[]> => {
  const { data } = await apiClient.get(`/events/${eventId}/users`);
  return data;
};

export const assignUserToEvent = async (
  eventId: string,
  userId: string,
  role: string
): Promise<EventUser> => {
  const { data } = await apiClient.post(`/events/${eventId}/users`, { userId, role });
  return data;
};

export const removeUserFromEvent = async (eventId: string, userId: string): Promise<void> => {
  await apiClient.delete(`/events/${eventId}/users/${userId}`);
};
