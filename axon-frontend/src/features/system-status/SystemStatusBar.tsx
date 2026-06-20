import { cn } from "@/utils/cn";
import { useAppStore } from "@/store";
import type { WsConnectionStatus } from "@/types/websocket";

const STATUS_META: Record<
  WsConnectionStatus,
  { label: string; dot: string }
> = {
  idle: { label: "Standby", dot: "bg-muted-foreground" },
  connecting: { label: "Connecting", dot: "bg-accent animate-pulse" },
  open: { label: "Connected", dot: "bg-primary ring-glow" },
  reconnecting: { label: "Reconnecting", dot: "bg-accent animate-pulse" },
  closed: { label: "Disconnected", dot: "bg-destructive" },
};

/**
 * Bottom region. Compact system telemetry. Phase 1 surfaces link + connectivity
 * state; future phases add device health (CPU, temp, camera, mic).
 */
export function SystemStatusBar() {
  const wsStatus = useAppStore((s) => s.wsStatus);
  const online = useAppStore((s) => s.online);
  const meta = STATUS_META[wsStatus];

  return (
    <div className="flex items-center justify-center gap-6 text-fluid-sm text-muted-foreground">
      <div className="flex items-center gap-2">
        <span className={cn("h-2 w-2 rounded-full", meta.dot)} />
        <span>{meta.label}</span>
      </div>
      <span className="opacity-40">|</span>
      <span>{online ? "Network OK" : "Offline"}</span>
      <span className="opacity-40">|</span>
      <span className="tracking-widest uppercase">Axon Phase 1</span>
    </div>
  );
}
