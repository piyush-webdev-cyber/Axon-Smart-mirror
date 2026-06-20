import { Cloud } from "lucide-react";

/**
 * Top-right region. Phase 1 stub: renders a polished placeholder so the layout
 * is complete. Phase 2 wires this to a weather service via TanStack Query
 * (see queryKeys.weather).
 */
export function WeatherWidget() {
  return (
    <div className="flex items-center gap-3 text-right">
      <div className="flex flex-col items-end">
        <span className="text-fluid-lg font-light leading-none tabular-nums">
          --&deg;
        </span>
        <span className="text-fluid-sm font-light text-muted-foreground">
          Weather offline
        </span>
      </div>
      <Cloud className="size-8 text-muted-foreground" strokeWidth={1.25} />
    </div>
  );
}
