import apiClient from "./client";

export type ShuttleDirection = "ANDATA" | "RITORNO";
export type ShuttleBoardStatus = "PENDING" | "BOARDED" | "NO_SHOW";

export interface ShuttleMachine {
  id: string;
  name: string;
  color?: string | null;
  active: boolean;
}

export interface ShuttleSlot {
  id: string;
  direction: ShuttleDirection;
  time: string;
  capacity: number;
  occupancy?: number;
}

export interface ShuttleAssignment {
  id: string;
  slotId: string;
  machineId: string;
  inviteeId?: string | null;
  fullName: string;
  status: ShuttleBoardStatus;
  slot: ShuttleSlot;
  machine: ShuttleMachine;
}

export const fetchShuttleConfig = async (eventId: string) => {
  const res = await apiClient.get(`/events/${eventId}/shuttles/config`);
  return res.data as {
    machines: ShuttleMachine[];
    slotCapacity: number;
    machineCapacity: number;
    outbound: { from: string; to: string };
    return: { from: string; to: string };
    stepMinutes: number;
  };
};

export const fetchSlots = async (eventId: string, direction: ShuttleDirection) => {
  const res = await apiClient.get<ShuttleSlot[]>(`/events/${eventId}/shuttles/slots`, { params: { direction } });
  return res.data;
};

export const fetchAssignments = async (eventId: string, params: { direction?: ShuttleDirection; time?: string; machineId?: string }) => {
  const res = await apiClient.get<ShuttleAssignment[]>(`/events/${eventId}/shuttles/assignments`, { params });
  return res.data;
};

export const createAssignment = async (eventId: string, payload: { direction: ShuttleDirection; time: string; machineId: string; inviteeId?: string; fullName?: string; }) => {
  const res = await apiClient.post<ShuttleAssignment>(`/events/${eventId}/shuttles/assignments`, payload);
  return res.data;
};

export const updateAssignmentStatus = async (eventId: string, id: string, status: ShuttleBoardStatus) => {
  const res = await apiClient.patch<ShuttleAssignment>(`/events/${eventId}/shuttles/assignments/${id}`, { status });
  return res.data;
};

export const deleteAssignment = async (eventId: string, id: string) => {
  await apiClient.delete(`/events/${eventId}/shuttles/assignments/${id}`);
};

export const deleteSlot = async (eventId: string, direction: ShuttleDirection, time: string) => {
  await apiClient.delete(`/events/${eventId}/shuttles/slots/${direction}/${encodeURIComponent(time)}`);
};

export interface SyncFromSheetsResult {
  message: string;
  newImported: number;
  updated: number;
  alreadyExists: number;
  deleted: number;
}

export const syncShuttlesFromSheets = async (eventId: string, direction: ShuttleDirection, pruneMissing = false): Promise<SyncFromSheetsResult> => {
  const res = await apiClient.post<SyncFromSheetsResult>(`/events/${eventId}/shuttles/sync-from-sheets`, {
    direction,
    pruneMissing,
  });
  return res.data;
};
