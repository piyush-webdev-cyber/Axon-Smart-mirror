import { env } from "@/utils/env";
import { WS_EVENTS } from "@/constants/wsEvents";
import type {
  WsConnectionStatus,
  WsHandler,
  WsMessage,
} from "@/types/websocket";

type StatusListener = (status: WsConnectionStatus) => void;

/**
 * Resilient WebSocket transport for Axon.
 *
 * Responsibilities (Phase 1 foundation):
 * - connect / disconnect with exponential-backoff auto-reconnect
 * - heartbeat ping/pong to detect dead connections
 * - typed pub/sub: feature modules subscribe by event type
 *
 * Future real-time features (voice, interview, face, music) just call
 * `subscribe(WS_EVENTS.someEvent, handler)` - no transport changes needed.
 */
class WebSocketClient {
  private socket: WebSocket | null = null;
  private status: WsConnectionStatus = "idle";

  private reconnectAttempts = 0;
  private readonly maxReconnectDelay = 15_000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private disconnectTimer: ReturnType<typeof setTimeout> | null = null;

  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private readonly heartbeatInterval = 25_000;

  private shouldReconnect = false;

  private handlers = new Map<string, Set<WsHandler>>();
  private statusListeners = new Set<StatusListener>();

  constructor() {}

  /** Resolve WS URL on each connect so dev env/HMR changes apply without reload. */
  private getUrl(): string {
    return env.wsUrl;
  }

  getStatus(): WsConnectionStatus {
    return this.status;
  }

  connect(): void {
    this.clearDisconnect();
    this.shouldReconnect = true;

    if (
      this.socket &&
      (this.socket.readyState === WebSocket.OPEN ||
        this.socket.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    this.setStatus(this.reconnectAttempts > 0 ? "reconnecting" : "connecting");

    try {
      this.socket = new WebSocket(this.getUrl());
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.socket.onopen = () => {
      this.reconnectAttempts = 0;
      this.setStatus("open");
      this.startHeartbeat();
    };

    this.socket.onmessage = (event) => this.handleMessage(event);

    this.socket.onclose = () => {
      this.stopHeartbeat();
      if (this.shouldReconnect) {
        this.scheduleReconnect();
      } else {
        this.setStatus("closed");
      }
    };

    this.socket.onerror = () => {
      // onclose will follow and drive reconnection
      this.socket?.close();
    };
  }

  disconnect(): void {
    this.shouldReconnect = false;
    this.clearReconnect();
    this.stopHeartbeat();
    this.clearDisconnect();

    const socket = this.socket;
    if (!socket) {
      this.setStatus("closed");
      return;
    }

    this.disconnectTimer = setTimeout(() => {
      socket.close();
      if (this.socket === socket) {
        this.socket = null;
        this.setStatus("closed");
      }
    }, 250);
  }

  send<TPayload>(type: string, payload: TPayload): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      const message: WsMessage<TPayload> = {
        type,
        payload,
        timestamp: new Date().toISOString(),
      };
      this.socket.send(JSON.stringify(message));
    }
  }

  /** Subscribe to a specific event type. Returns an unsubscribe function. */
  subscribe<TPayload>(type: string, handler: WsHandler<TPayload>): () => void {
    const set = this.handlers.get(type) ?? new Set();
    set.add(handler as WsHandler);
    this.handlers.set(type, set);
    return () => {
      set.delete(handler as WsHandler);
    };
  }

  onStatusChange(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  private handleMessage(event: MessageEvent): void {
    let message: WsMessage;
    try {
      message = JSON.parse(event.data as string) as WsMessage;
    } catch {
      return;
    }

    if (message.type === WS_EVENTS.pong) return;

    this.handlers.get(message.type)?.forEach((handler) => {
      try {
        handler(message);
      } catch {
        /* a single bad handler must not break the transport */
      }
    });
  }

  private setStatus(status: WsConnectionStatus): void {
    this.status = status;
    this.statusListeners.forEach((listener) => listener(status));
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.send(WS_EVENTS.ping, { t: Date.now() });
    }, this.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect(): void {
    this.clearReconnect();
    this.setStatus("reconnecting");
    const delay = Math.min(
      this.maxReconnectDelay,
      1000 * 2 ** this.reconnectAttempts,
    );
    this.reconnectAttempts += 1;
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  private clearReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private clearDisconnect(): void {
    if (this.disconnectTimer) {
      clearTimeout(this.disconnectTimer);
      this.disconnectTimer = null;
    }
  }
}

export const websocketClient = new WebSocketClient();
