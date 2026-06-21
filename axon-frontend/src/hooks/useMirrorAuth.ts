import { useEffect } from "react";
import { useAppStore } from "@/store";
import { MIRROR_LINKED_EVENT } from "@/utils/authToken";
import { readMirrorLinkFromStorage } from "@/utils/mirrorLink";

/** Sync mirror link state from localStorage into Zustand. */
export function useMirrorAuth() {
  const mirrorLinked = useAppStore((s) => s.mirrorLinked);
  const mirrorUserId = useAppStore((s) => s.mirrorUserId);
  const mirrorEmail = useAppStore((s) => s.mirrorEmail);
  const mirrorDisplayName = useAppStore((s) => s.mirrorDisplayName);
  const hydrateMirrorAuth = useAppStore((s) => s.hydrateMirrorAuth);

  useEffect(() => {
    hydrateMirrorAuth();

    const sync = () => hydrateMirrorAuth();
    window.addEventListener(MIRROR_LINKED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(MIRROR_LINKED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [hydrateMirrorAuth]);

  return {
    linked: mirrorLinked || readMirrorLinkFromStorage().mirrorLinked,
    userId: mirrorUserId,
    email: mirrorEmail,
    displayName: mirrorDisplayName,
  };
}
