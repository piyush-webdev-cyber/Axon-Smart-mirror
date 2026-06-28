import { memo } from "react";
import { cn } from "@/utils/cn";

interface LiveTranscriptProps {
  /** Partial text while user is still speaking. */
  interimText?: string;
  /** Final recognized text (frozen after speech ends). */
  finalText?: string;
  /** When true, show final text without live pulse. */
  frozen?: boolean;
  className?: string;
}

/**
 * Two-line live subtitle strip. Only re-renders when displayed text changes.
 */
export const LiveTranscript = memo(function LiveTranscript({
  interimText = "",
  finalText = "",
  frozen = false,
  className,
}: LiveTranscriptProps) {
  const interim = interimText.trim();
  const final = finalText.trim();
  const display = interim || final;

  if (!display) return null;

  const isLive = Boolean(interim) && !frozen;

  return (
    <p
      className={cn(
        "w-full max-w-md text-center text-base leading-snug text-content",
        "line-clamp-2 overflow-hidden text-ellipsis transition-opacity duration-300 ease-out",
        isLive && "animate-pulse",
        className,
      )}
      aria-live="polite"
      aria-atomic="true"
      title={display.length > 80 ? display : undefined}
    >
      {display}
    </p>
  );
});
