import { useEffect } from "react";
import { useWebSocketBridge } from "@/hooks/useWebSocketBridge";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useOAuthLinkRecovery } from "@/hooks/useOAuthLinkRecovery";
import { useAppStore } from "@/store";

/**
 * Headless component that activates app-wide side effects exactly once, inside
 * the provider tree. Renders nothing.
 */
export function GlobalEffects() {
  const hydrateMirrorAuth = useAppStore((s) => s.hydrateMirrorAuth);

  useEffect(() => {
    hydrateMirrorAuth();
  }, [hydrateMirrorAuth]);

  useWebSocketBridge();
  useOnlineStatus();
  useOAuthLinkRecovery();
  return null;
}
