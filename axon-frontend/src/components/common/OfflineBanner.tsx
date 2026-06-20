import { WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

/** Subtle, non-intrusive connectivity indicator for the mirror. */
export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center p-3 animate-fade-in">
      <div className="flex items-center gap-2 rounded-full border border-destructive/40 bg-destructive/15 px-4 py-1.5 backdrop-blur-md">
        <WifiOff className="text-destructive" />
        <span className="text-fluid-sm text-destructive-foreground">
          Offline - reconnecting automatically
        </span>
      </div>
    </div>
  );
}
