import { Outlet } from "react-router-dom";
import { WeatherWidget } from "@/features/weather/WeatherWidget";
import { MicButton } from "@/features/voice/MicButton";
import { SystemStatusBar } from "@/features/system-status/SystemStatusBar";
import { Sidebar } from "@/components/navigation/Sidebar";

/**
 * The canonical Axon mirror frame. A fluid CSS grid that adapts to any
 * orientation or display size with zero hardcoded pixel dimensions.
 *
 * Regions:
 *   left          -> Navigation sidebar (fixed) with clock at top
 *   top-right     -> Weather
 *   center        -> Dynamic content (router Outlet)
 *   bottom-center -> Voice mic button
 *   bottom        -> System status
 */
export function MirrorLayout() {
  return (
    <div className="relative h-full w-full">
      <Sidebar />

      <div className="relative ml-[11rem] grid h-full w-[calc(100%-11rem)] grid-rows-[auto_1fr_auto] gap-3 p-[clamp(0.875rem,2.4vw,2.75rem)]">
        {/* Ambient intelligence backdrop - the glow is anchored low, over the
            assistant core, so the whole screen reads as light emanating from
            Axon. Decorative, GPU-composited, disabled under reduced motion. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute left-[62%] top-[72%] h-[76vmin] w-[76vmin] -translate-x-1/2 -translate-y-1/2 rounded-full bg-glow-radial blur-3xl animate-aurora-drift gpu" />
        </div>

        {/* Top bar: weather (right) */}
        <header className="flex items-start justify-end gap-6">
          <WeatherWidget />
        </header>

        {/* Center: dynamic content area, weighted toward the assistant below */}
        <main className="flex min-h-0 items-center justify-center overflow-hidden">
          <Outlet />
        </main>

        {/* Bottom: living assistant core (focal point) above system status */}
        <footer className="flex flex-col items-center gap-1.5">
          <MicButton />
          <SystemStatusBar />
        </footer>
      </div>
    </div>
  );
}
