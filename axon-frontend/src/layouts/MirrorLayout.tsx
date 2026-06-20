import { Outlet } from "react-router-dom";
import { ClockWidget } from "@/features/clock/ClockWidget";
import { WeatherWidget } from "@/features/weather/WeatherWidget";
import { MicButton } from "@/features/voice/MicButton";
import { SystemStatusBar } from "@/features/system-status/SystemStatusBar";

/**
 * The canonical Axon mirror frame. A fluid CSS grid that adapts to any
 * orientation or display size with zero hardcoded pixel dimensions.
 *
 * Regions:
 *   top-left      -> Clock
 *   top-right     -> Weather
 *   center        -> Dynamic content (router Outlet)
 *   bottom-center -> Voice mic button
 *   bottom        -> System status
 */
export function MirrorLayout() {
  return (
    <div className="relative grid h-full w-full grid-rows-[auto_1fr_auto] gap-4 p-[clamp(1rem,3vw,3.5rem)]">
      {/* Top bar: clock (left) + weather (right) */}
      <header className="flex items-start justify-between gap-6">
        <ClockWidget />
        <WeatherWidget />
      </header>

      {/* Center: dynamic content area */}
      <main className="flex min-h-0 items-center justify-center overflow-hidden">
        <Outlet />
      </main>

      {/* Bottom: mic button (center) above system status */}
      <footer className="flex flex-col items-center gap-4">
        <MicButton />
        <SystemStatusBar />
      </footer>
    </div>
  );
}
