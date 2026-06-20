import { cn } from "@/utils/cn";

interface BrandedLoaderProps {
  label?: string;
  fullscreen?: boolean;
}

/** Suspense / boot fallback. Minimal, premium, theme-aware. */
export function BrandedLoader({
  label = "Axon",
  fullscreen = true,
}: BrandedLoaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-6",
        fullscreen ? "h-full w-full" : "py-12",
      )}
    >
      <div className="relative flex h-16 w-16 items-center justify-center">
        <span className="absolute inset-0 rounded-full bg-primary/30 animate-pulse-ring" />
        <span className="h-3 w-3 rounded-full bg-primary ring-glow animate-breathe" />
      </div>
      <span className="text-fluid-sm font-light tracking-[0.5em] text-muted-foreground uppercase">
        {label}
      </span>
    </div>
  );
}
