import type { LucideIcon } from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "@/utils/cn";

interface NavItemProps {
  to?: string;
  label: string;
  icon: LucideIcon;
  active?: boolean;
  onClick?: () => void;
}

/**
 * Reusable rail item used by the mirror sidebar. Horizontal layout with icon
 * on the left and label on the right.
 */
export function NavItem({
  to,
  label,
  icon: Icon,
  active = false,
  onClick,
}: NavItemProps) {
  const sharedClassName =
    "group relative flex w-full items-center gap-3 rounded-xl border border-transparent px-4 py-2.5 text-white/90 transition-all duration-300 ease-out";

  const content = (
    <>
      <Icon
        className={cn(
          "size-5 shrink-0 transition-colors duration-300",
          active ? "text-white" : "text-white/80 group-hover:text-white",
        )}
        strokeWidth={1.8}
        aria-hidden
      />
      <span
        className={cn(
          "text-sm font-light tracking-wide text-white transition-colors duration-300",
        )}
      >
        {label}
      </span>
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 rounded-xl transition-all duration-300",
          active
            ? "border border-primary/40 bg-primary/15 ring-glow"
            : "group-hover:border-white/10 group-hover:bg-white/5",
        )}
      />
    </>
  );

  if (!to) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className={sharedClassName}
      >
        {content}
      </button>
    );
  }

  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(sharedClassName, isActive && "text-white")
      }
      aria-label={label}
    >
      {({ isActive }) => {
        const finalActive = active || isActive;
        return (
          <>
            <Icon
              className={cn(
                "size-5 shrink-0 transition-colors duration-300",
                finalActive
                  ? "text-white"
                  : "text-white/80 group-hover:text-white",
              )}
              strokeWidth={1.8}
              aria-hidden
            />
            <span
              className={cn(
                "text-sm font-light tracking-wide text-white transition-colors duration-300",
              )}
            >
              {label}
            </span>
            <span
              aria-hidden
              className={cn(
                "pointer-events-none absolute inset-0 rounded-xl transition-all duration-300",
                finalActive
                  ? "border border-primary/40 bg-primary/15 ring-glow"
                  : "group-hover:border-white/10 group-hover:bg-white/5",
              )}
            />
          </>
        );
      }}
    </NavLink>
  );
}
