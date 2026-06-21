/** Countdown, capture flash, upload, and success overlays for the camera page. */

import type { CameraState } from "@/store/slices/cameraSlice";
import { cn } from "@/utils/cn";

export function CameraCountdownOverlay({
  countdown,
  cameraState,
  successMessage,
}: {
  countdown: number | null;
  cameraState: CameraState;
  successMessage: string | null;
}) {
  if (cameraState === "success" && successMessage) {
    return (
      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 animate-fade-in">
        <span className="mb-2 text-5xl">📸</span>
        <p className="text-heading font-semibold text-glow">{successMessage}</p>
      </div>
    );
  }

  if (cameraState === "uploading") {
    return (
      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/70 animate-fade-in">
        <div className="mb-4 size-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-body text-content">Uploading...</p>
      </div>
    );
  }

  if (cameraState === "countdown" && countdown !== null) {
    return (
      <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 animate-fade-in">
        <span
          key={countdown}
          className={cn(
            "text-[clamp(4rem,12vw,8rem)] font-light tabular-nums text-glow animate-fade-in",
            countdown === 0 && "scale-110",
          )}
        >
          {countdown}
        </span>
      </div>
    );
  }

  if (cameraState === "capturing") {
    return (
      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/20 animate-fade-in">
        <span className="text-5xl">📸</span>
        <p className="mt-2 text-body font-medium text-content">Photo Captured</p>
      </div>
    );
  }

  return null;
}
