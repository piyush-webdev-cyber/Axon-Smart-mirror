import { Link } from "react-router-dom";
import {
  Briefcase,
  Camera,
  House,
  Image,
  Music,
  Settings,
  UserRound,
} from "lucide-react";
import { ROUTES } from "@/constants/routes";
import { useAuth } from "@/context/AuthProvider";
import { useMirrorAuth } from "@/hooks/useMirrorAuth";
import { NavItem } from "./NavItem";
import { ClockWidget } from "@/features/clock/ClockWidget";

interface SidebarNavItem {
  label: string;
  icon: typeof House;
  to?: string;
}

const NAV_ITEMS: SidebarNavItem[] = [
  { label: "Home", icon: House, to: ROUTES.home },
  { label: "Camera", icon: Camera, to: ROUTES.camera },
  { label: "Interview", icon: Briefcase },
  { label: "Gallery", icon: Image, to: ROUTES.gallery },
  { label: "Songs", icon: Music },
  { label: "Settings", icon: Settings, to: ROUTES.settings },
];

export function Sidebar() {
  const { user, loading } = useAuth();
  const { linked: mirrorLinked, userId: mirrorUserId, email: mirrorEmail, displayName } =
    useMirrorAuth();

  const isAuthenticated = Boolean(user) || mirrorLinked;

  const accountLabel = loading
    ? "Account"
    : user
      ? user.email?.split("@")[0] ?? user.id.slice(0, 8)
      : mirrorLinked
        ? displayName ?? mirrorEmail?.split("@")[0] ?? mirrorUserId?.slice(0, 8) ?? "Linked"
        : "Connect";

  const accountSubLabel = mirrorLinked
    ? mirrorEmail ?? mirrorUserId
    : user?.email ?? null;

  return (
    <aside className="pointer-events-none fixed inset-y-0 left-0 z-30 w-[11rem] p-3">
      <div className="pointer-events-auto relative flex h-full w-full flex-col rounded-[2rem] bg-surface/30 px-4 py-6 backdrop-blur-xl">
        <div className="mb-11">
          <ClockWidget />
        </div>

        <nav aria-label="Primary" className="flex flex-1 flex-col">
          <ul className="grid w-full gap-2">
            {NAV_ITEMS.map((item) => (
              <li key={item.label}>
                <NavItem
                  {...(item.to ? { to: item.to } : {})}
                  label={item.label}
                  icon={item.icon}
                />
              </li>
            ))}
          </ul>
        </nav>

        <Link
          to={isAuthenticated ? ROUTES.home : ROUTES.login}
          className="group relative mt-auto flex flex-col gap-0.5 rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-white transition-all duration-300 hover:border-primary/35 hover:bg-primary/10 hover:ring-glow"
        >
          <span className="flex items-center gap-2.5">
            <UserRound className="size-4 shrink-0 text-white" strokeWidth={1.7} />
            <span className="truncate text-sm font-light tracking-wide text-white">
              {accountLabel}
            </span>
          </span>
          {isAuthenticated && accountSubLabel && (
            <span className="truncate pl-6 text-[10px] text-text-secondary">
              {accountSubLabel}
            </span>
          )}
        </Link>
      </div>
    </aside>
  );
}
