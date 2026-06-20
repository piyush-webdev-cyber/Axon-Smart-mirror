import { useWebSocketBridge } from "@/hooks/useWebSocketBridge";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

/**
 * Headless component that activates app-wide side effects exactly once, inside
 * the provider tree. Renders nothing.
 */
export function GlobalEffects() {
  useWebSocketBridge();
  useOnlineStatus();
  return null;
}
