import { useNavigate, useLocation } from "react-router-dom";
import { UserRound } from "lucide-react";
import { profilePath, ROUTES } from "@/constants/routes";
import { useAuth } from "@/context/AuthProvider";
import { useMirrorAuth } from "@/hooks/useMirrorAuth";
import { isMirrorLinked } from "@/utils/authToken";
import { cn } from "@/utils/cn";

export function AccountMenu() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading } = useAuth();
  const { linked: mirrorLinked, userId, email, displayName } = useMirrorAuth();

  const isAuthenticated = Boolean(user) || mirrorLinked || isMirrorLinked();

  const accountLabel = loading
    ? "Account"
    : user
      ? user.email?.split("@")[0] ?? user.id.slice(0, 8)
      : mirrorLinked
        ? displayName ?? email?.split("@")[0] ?? userId?.slice(0, 8) ?? "Linked"
        : "Connect";

  const accountId = user?.id ?? userId ?? null;
  const isProfileActive =
    accountId != null && location.pathname === profilePath(accountId);

  const handleClick = () => {
    if (isAuthenticated && accountId) {
      navigate(profilePath(accountId));
      return;
    }
    navigate(ROUTES.home, { replace: true });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "group mt-auto flex w-full min-w-0 max-w-full items-center gap-2.5 overflow-hidden rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-left text-white transition-all duration-300",
        "hover:border-primary/35 hover:bg-primary/10 hover:ring-glow",
        isProfileActive && "border-primary/35 bg-primary/10 ring-glow",
      )}
      aria-current={isProfileActive ? "page" : undefined}
      aria-label={accountLabel}
    >
      <UserRound className="size-4 shrink-0 text-white" strokeWidth={1.7} />
      <span className="min-w-0 truncate text-sm font-light tracking-wide text-white">
        {accountLabel}
      </span>
    </button>
  );
}
