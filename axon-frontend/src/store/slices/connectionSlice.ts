import type { StateCreator } from "zustand";
import type { WsConnectionStatus } from "@/types/websocket";

export interface ConnectionSlice {
  wsStatus: WsConnectionStatus;
  online: boolean;
  lastConnectedAt: number | null;
  setWsStatus: (status: WsConnectionStatus) => void;
  setOnline: (online: boolean) => void;
}

export const createConnectionSlice: StateCreator<
  ConnectionSlice,
  [],
  [],
  ConnectionSlice
> = (set) => ({
  wsStatus: "idle",
  online: typeof navigator !== "undefined" ? navigator.onLine : true,
  lastConnectedAt: null,
  setWsStatus: (wsStatus) =>
    set((state) => ({
      wsStatus,
      lastConnectedAt:
        wsStatus === "open" ? Date.now() : state.lastConnectedAt,
    })),
  setOnline: (online) => set({ online }),
});
