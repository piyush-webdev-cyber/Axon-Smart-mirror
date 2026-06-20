import { cn } from "@/utils/cn";
import { useAppStore } from "@/store";
import type { WsConnectionStatus } from "@/types/websocket";

type DisplayStatus = "online" | "connecting" | "reconnecting" | "offline";

interface StatusMeta {
  label: string;
  dot: string;
  text: string;
  pulse: boolean;
}

const STATUS_META: Record<DisplayStatus, StatusMeta> = {
  online: {
    label: "Online",
    dot: "bg-primary shadow-[0_0_8px_rgba(59,130,246,0.6)]",
    text: "text-white",
    pulse: false,
  },
  connecting: {
    label: "Connecting",
    dot: "bg-warning",
    text: "text-white/60",
    pulse: true,
  },
  reconnecting: {
    label: "Reconnecting",
    dot: "bg-warning",
    text: "text-white/60",
    pulse: true,
  },
  offline: {
    label: "Offline",
    dot: "bg-error",
    text: "text-white/60",
    pulse: false,
  },
};

function resolveStatus(
  wsStatus: WsConnectionStatus,
  online: boolean,
): DisplayStatus {
  if (!online) return "offline";
  switch (wsStatus) {
    case "open":
      return "online";
    case "reconnecting":
      return "reconnecting";
    case "closed":
      return "offline";
    case "connecting":
    case "idle":
    default:
      return "connecting";
  }
}

/**
 * Minimal centered status indicator for premium AI mirror.
 */
export function SystemStatusBar() {
  const wsStatus = useAppStore((s) => s.wsStatus);
  const online = useAppStore((s) => s.online);
  const status = resolveStatus(wsStatus, online);
  const meta = STATUS_META[status];

  return (
    <div
      className="flex items-center gap-2.5"
      role="status"
      aria-live="polite"
      aria-label={`System status: ${meta.label}`}
    >
      <span className="relative flex size-2 items-center justify-center">
        {meta.pulse && (
          <span
            aria-hidden
            className={cn(
              "absolute inset-0 rounded-full opacity-60 animate-beacon",
              meta.dot,
            )}
          />
        )}
        <span className={cn("size-1.5 rounded-full", meta.dot)} />
      </span>
      <span
        key={status}
        className={cn(
          "text-sm font-light uppercase tracking-widest animate-fade-in",
          meta.text,
        )}
      >
        {meta.label}
      </span>
    </div>
  );
}
