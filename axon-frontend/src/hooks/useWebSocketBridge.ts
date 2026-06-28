import { useEffect } from "react";
import { websocketClient } from "@/services/websocketClient";
import { useAppStore } from "@/store";
import { MIRROR_LINKED_EVENT } from "@/utils/authToken";

/**
 * Connects the singleton WebSocket client on mount and mirrors its status into
 * the global store. Mount this once near the app root. Feature modules then
 * subscribe to specific events via `websocketClient.subscribe(...)`.
 */
export function useWebSocketBridge(): void {
  const setWsStatus = useAppStore((s) => s.setWsStatus);

  useEffect(() => {
    const unsubscribe = websocketClient.onStatusChange(setWsStatus);
    websocketClient.connect();

    const onLinked = () => {
      websocketClient.disconnect();
      websocketClient.connect();
    };
    window.addEventListener(MIRROR_LINKED_EVENT, onLinked);

    return () => {
      window.removeEventListener(MIRROR_LINKED_EVENT, onLinked);
      unsubscribe();
      websocketClient.disconnect();
    };
  }, [setWsStatus]);
}
