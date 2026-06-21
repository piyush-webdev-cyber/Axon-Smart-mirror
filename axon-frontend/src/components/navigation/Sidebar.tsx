import {
  Briefcase,
  Camera,
  House,
  Image,
  Music,
  Settings,
} from "lucide-react";
import { ROUTES } from "@/constants/routes";
import { AccountMenu } from "./AccountMenu";
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
  return (
    <aside className="pointer-events-none fixed inset-y-0 left-0 z-30 w-[11rem] p-3">
      <div className="pointer-events-auto relative flex h-full w-full flex-col rounded-[2rem] bg-surface/30 px-4 py-6 backdrop-blur-xl">
        <div className="mb-11">
          <ClockWidget />
        </div>

        <nav aria-label="Primary" className="flex min-h-0 flex-1 flex-col">
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

        <AccountMenu />
      </div>
    </aside>
  );
}
