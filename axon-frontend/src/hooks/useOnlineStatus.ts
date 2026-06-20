import { useEffect } from "react";
import { useAppStore } from "@/store";

/**
 * Syncs browser online/offline events into the global store so any component
 * can react to connectivity (offline banner, query pausing, etc.).
 */
export function useOnlineStatus(): boolean {
  const online = useAppStore((s) => s.online);
  const setOnline = useAppStore((s) => s.setOnline);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [setOnline]);

  return online;
}
