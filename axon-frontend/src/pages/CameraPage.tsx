/** Camera page — live preview, countdown capture, voice-triggered photos. */

import { CameraCountdownOverlay } from "@/features/camera/CameraCountdownOverlay";
import { useCameraCapture } from "@/features/camera/useCameraCapture";
import { cn } from "@/utils/cn";

export default function CameraPage() {
  const {
    videoRef,
    canvasRef,
    cameraState,
    countdown,
    error,
    successMessage,
    onVideoReady,
    runCountdown,
    cancel,
    retry,
  } = useCameraCapture();

  const isBusy =
    cameraState === "countdown" ||
    cameraState === "capturing" ||
    cameraState === "uploading";

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col bg-black">
      <div className="glass-surface z-10 flex items-center justify-between px-6 py-4">
        <h1 className="text-subheading font-semibold">Camera</h1>
        <button
          type="button"
          onClick={cancel}
          className="text-body text-text-secondary transition-colors hover:text-foreground"
        >
          Cancel
        </button>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          onLoadedMetadata={onVideoReady}
          onCanPlay={onVideoReady}
          className="h-full w-full object-cover"
        />
        <canvas ref={canvasRef} className="hidden" />

        <CameraCountdownOverlay
          countdown={countdown}
          cameraState={cameraState}
          successMessage={successMessage}
        />

        {error && cameraState === "error" && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/80">
            <div className="text-center">
              <p className="mb-4 text-xl text-error">{error}</p>
              <div className="flex justify-center gap-3">
                <button
                  type="button"
                  onClick={retry}
                  className="glass-surface px-6 py-3 text-body font-medium text-primary"
                >
                  Retry
                </button>
                <button
                  type="button"
                  onClick={cancel}
                  className="glass-surface px-6 py-3 text-body font-medium text-foreground"
                >
                  Go Back
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="glass-surface z-10 px-6 py-6">
        <div className="flex justify-center">
          <button
            type="button"
            onClick={runCountdown}
            disabled={isBusy || cameraState === "error"}
            aria-label="Take photo"
            className={cn(
              "h-16 w-16 rounded-full border-4 border-primary bg-primary/20 transition-all",
              "hover:bg-primary/40 hover:ring-8 hover:ring-primary/30",
              "disabled:cursor-not-allowed disabled:opacity-40",
            )}
          />
        </div>
        <p className="mt-3 text-center text-caption text-content-muted">
          {isBusy ? "Hold still..." : 'Say "Nexa, take a photo" or tap to capture'}
        </p>
      </div>
    </div>
  );
}
