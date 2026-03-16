import { createContext, type ReactNode, useContext, useMemo, useState } from "react";

export type EventModule = "tshirts" | "expenses" | "shuttles";

export interface EventInfo {
  id: string;
  name: string;
  date?: string | null;
  googleSheetId?: string | null;
  modules: EventModule[];
  status: "ACTIVE" | "PAUSED" | "LOCKED";
  myRole?: string;
}

interface EventContextValue {
  currentEvent: EventInfo | null;
  selectEvent: (event: EventInfo) => void;
  clearEvent: () => void;
  hasModule: (module: EventModule) => boolean;
}

const EventContext = createContext<EventContextValue | undefined>(undefined);

export const EVENT_STORAGE_KEY = "ingresso-festa-event";

export const EventProvider = ({ children }: { children: ReactNode }) => {
  const [currentEvent, setCurrentEvent] = useState<EventInfo | null>(() => {
    try {
      const stored = localStorage.getItem(EVENT_STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const selectEvent = (event: EventInfo) => {
    setCurrentEvent(event);
    localStorage.setItem(EVENT_STORAGE_KEY, JSON.stringify(event));
  };

  const clearEvent = () => {
    setCurrentEvent(null);
    localStorage.removeItem(EVENT_STORAGE_KEY);
  };

  const hasModule = (module: EventModule) =>
    currentEvent?.modules.includes(module) ?? false;

  const value = useMemo(
    () => ({ currentEvent, selectEvent, clearEvent, hasModule }),
    [currentEvent]
  );

  return <EventContext.Provider value={value}>{children}</EventContext.Provider>;
};

export const useEvent = () => {
  const context = useContext(EventContext);
  if (!context) throw new Error("useEvent deve essere usato dentro EventProvider");
  return context;
};
