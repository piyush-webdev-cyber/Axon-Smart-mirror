import {
  Briefcase,
  Camera,
  House,
  Image,
  Music,
  Settings,
  UserRound,
} from "lucide-react";
import { Link } from "react-router-dom";
import { ROUTES } from "@/constants/routes";
import { NavItem } from "./NavItem";
import { ClockWidget } from "@/features/clock/ClockWidget";

interface SidebarNavItem {
  label: string;
  icon: typeof House;
  to?: string;
}

const NAV_ITEMS: SidebarNavItem[] = [
  { label: "Home", icon: House, to: ROUTES.home },
  { label: "Camera", icon: Camera },
  { label: "Interview", icon: Briefcase },
  { label: "Gallery", icon: Image },
  { label: "Songs", icon: Music },
  { label: "Settings", icon: Settings, to: ROUTES.settings },
];

/**
 * Premium fixed left rail for Axon mirror navigation.
 * - Clock at the top
 * - Glassmorphism black surface with rounded corners
 * - Horizontal icon + label layout
 * - Bottom auth CTA
 */
export function Sidebar() {
  return (
    <aside className="pointer-events-none fixed inset-y-0 left-0 z-30 w-[11rem] p-3">
      <div className="pointer-events-auto relative flex h-full w-full flex-col rounded-[2rem] bg-surface/30 px-4 py-6 backdrop-blur-xl">
        {/* Clock at top */}
        <div className="mb-11">
          <ClockWidget />
        </div>

        {/* Navigation items */}
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

        {/* Login/Sign Up at bottom */}
        <Link
          to={ROUTES.login}
          className="group relative mt-auto flex items-center gap-2.5 rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-white transition-all duration-300 hover:border-primary/35 hover:bg-primary/10 hover:ring-glow"
        >
          <UserRound className="size-4 shrink-0 text-white" strokeWidth={1.7} />
          <span className="text-sm font-light tracking-wide text-white">
            Login / Sign Up
          </span>
        </Link>
      </div>
    </aside>
  );
}
