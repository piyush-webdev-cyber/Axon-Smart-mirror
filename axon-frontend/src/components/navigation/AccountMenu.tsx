import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, UserRound } from "lucide-react";
import { ROUTES } from "@/constants/routes";
import { useAuth } from "@/context/AuthProvider";
import { useMirrorAuth } from "@/hooks/useMirrorAuth";
import { useAppStore } from "@/store";
import { getLinkedDeviceCode, isMirrorLinked } from "@/utils/authToken";
import { cn } from "@/utils/cn";

export function AccountMenu() {
  const navigate = useNavigate();
  const { user, loading, signOut } = useAuth();
  const { linked: mirrorLinked, userId, email, displayName } = useMirrorAuth();
  const clearMirrorLink = useAppStore((s) => s.clearMirrorLink);

  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const isAuthenticated = Boolean(user) || mirrorLinked || isMirrorLinked();

  const accountLabel = loading
    ? "Account"
    : user
      ? user.email?.split("@")[0] ?? user.id.slice(0, 8)
      : mirrorLinked
        ? displayName ?? email?.split("@")[0] ?? userId?.slice(0, 8) ?? "Linked"
        : "Connect";

  const accountEmail = user?.email ?? email ?? null;
  const deviceCode = getLinkedDeviceCode();
  const accountId = user?.id ?? userId ?? null;

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const handleLogout = async () => {
    setOpen(false);
    if (user) await signOut();
    if (mirrorLinked || isMirrorLinked()) clearMirrorLink();
    navigate(ROUTES.home, { replace: true });
  };

  const handleConnect = () => {
    setOpen(false);
    navigate(ROUTES.home, { replace: true });
  };

  return (
    <div ref={rootRef} className="relative mt-auto w-full min-w-0">
      {open && isAuthenticated && (
        <div
          className="absolute bottom-full left-0 z-50 mb-2 w-full max-w-[14rem] rounded-2xl border border-white/15 bg-surface/95 p-4 shadow-xl backdrop-blur-xl animate-fade-in"
          role="dialog"
          aria-label="Account details"
        >
          <p className="mb-3 text-caption font-medium uppercase tracking-wider text-text-secondary">
            Account
          </p>

          {deviceCode && (
            <div className="mb-3">
              <p className="text-[10px] uppercase tracking-wide text-text-secondary">
                Device code
              </p>
              <p className="font-mono text-body font-semibold tracking-wider text-primary">
                {deviceCode}
              </p>
            </div>
          )}

          {accountEmail && (
            <div className="mb-3 min-w-0">
              <p className="text-[10px] uppercase tracking-wide text-text-secondary">Email</p>
              <p className="break-all text-caption text-foreground">{accountEmail}</p>
            </div>
          )}

          {accountId && (
            <div className="mb-4 min-w-0">
              <p className="text-[10px] uppercase tracking-wide text-text-secondary">User ID</p>
              <p className="break-all font-mono text-[10px] text-text-secondary">{accountId}</p>
            </div>
          )}

          <button
            type="button"
            onClick={() => void handleLogout()}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-error/30 bg-error/10 px-3 py-2.5 text-caption font-medium text-error transition-colors hover:bg-error/20"
          >
            <LogOut className="size-4" />
            Log out
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          if (isAuthenticated) setOpen((prev) => !prev);
          else handleConnect();
        }}
        className={cn(
          "group flex w-full min-w-0 max-w-full items-center gap-2.5 overflow-hidden rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-left text-white transition-all duration-300",
          "hover:border-primary/35 hover:bg-primary/10 hover:ring-glow",
          open && isAuthenticated && "border-primary/35 bg-primary/10 ring-glow",
        )}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={accountLabel}
      >
        <UserRound className="size-4 shrink-0 text-white" strokeWidth={1.7} />
        <span className="min-w-0 truncate text-sm font-light tracking-wide text-white">
          {accountLabel}
        </span>
      </button>
    </div>
  );
}
