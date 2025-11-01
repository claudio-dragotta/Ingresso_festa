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
  time: string; // HH:mm
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

export const fetchShuttleConfig = async () => {
  const res = await apiClient.get("/shuttles/config");
  return res.data as {
    machines: ShuttleMachine[];
    slotCapacity: number;
    machineCapacity: number;
    outbound: { from: string; to: string };
    return: { from: string; to: string };
    stepMinutes: number;
  };
};

export const fetchSlots = async (direction: ShuttleDirection) => {
  const res = await apiClient.get<ShuttleSlot[]>("/shuttles/slots", { params: { direction } });
  return res.data;
};

export const fetchAssignments = async (params: { direction?: ShuttleDirection; time?: string; machineId?: string }) => {
  const res = await apiClient.get<ShuttleAssignment[]>("/shuttles/assignments", { params });
  return res.data;
};

export const createAssignment = async (payload: { direction: ShuttleDirection; time: string; machineId: string; inviteeId?: string; fullName?: string; }) => {
  const res = await apiClient.post<ShuttleAssignment>("/shuttles/assignments", payload);
  return res.data;
};

export const updateAssignmentStatus = async (id: string, status: ShuttleBoardStatus) => {
  const res = await apiClient.patch<ShuttleAssignment>(`/shuttles/assignments/${id}`, { status });
  return res.data;
};

export const deleteAssignment = async (id: string) => {
  await apiClient.delete(`/shuttles/assignments/${id}`);
};

