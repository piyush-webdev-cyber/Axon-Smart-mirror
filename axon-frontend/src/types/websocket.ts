import type { WsEventType } from "@/constants/wsEvents";

/** Typed envelope used for every message across the WebSocket transport. */
export interface WsMessage<TPayload = unknown> {
  type: WsEventType | string;
  payload: TPayload;
  timestamp?: string;
}

export type WsConnectionStatus =
  | "idle"
  | "connecting"
  | "open"
  | "reconnecting"
  | "closed";

export type WsHandler<TPayload = unknown> = (message: WsMessage<TPayload>) => void;
