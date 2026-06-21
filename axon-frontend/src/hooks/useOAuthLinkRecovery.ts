import { useEffect } from "react";

const PENDING_LINK_KEY = "axon_pending_link_code";

/**
 * Supabase may redirect to Site URL (e.g. localhost:5173/) when redirectTo is
 * not allowlisted. Recover by sending the session hash to /link/:code.
 */
export function useOAuthLinkRecovery(): void {
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.includes("access_token")) return;

    const pending = localStorage.getItem(PENDING_LINK_KEY)?.trim().toUpperCase();
    if (!pending) return;

    const expectedPath = `/link/${pending}`;
    if (window.location.pathname.toUpperCase() === expectedPath) return;

    window.location.replace(
      `${window.location.origin}${expectedPath}${hash}`,
    );
  }, []);
}
