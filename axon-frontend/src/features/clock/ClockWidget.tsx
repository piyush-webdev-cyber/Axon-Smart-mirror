import { useClock } from "./useClock";

interface ClockWidgetProps {
  /** 12-hour clock with AM/PM (default) vs 24-hour. */
  hour12?: boolean;
  showSeconds?: boolean;
}

/**
 * Top-left region. Large, glanceable time legible from 3-4m away.
 * The minute drives a `key` so the time gently fades on each change while the
 * seconds stay silent - calm, never busy.
 */
export function ClockWidget({
  hour12 = true,
  showSeconds = false,
}: ClockWidgetProps) {
  const { time, period, date, minuteKey } = useClock({ hour12, showSeconds });

  return (
    <div className="flex flex-col">
      <div className="flex items-end gap-2">
        <span
          key={minuteKey}
          className="text-display-lg tabular-nums font-semibold text-content gpu animate-fade-in-down"
        >
          {time}
        </span>
        {period && (
          <span className="mb-[0.25em] text-heading font-light tracking-[0.06em] text-content">
            {period}
          </span>
        )}
      </div>
      <span className="mt-0.5 text-subheading font-light text-content-muted">
        {date}
      </span>
    </div>
  );
}
