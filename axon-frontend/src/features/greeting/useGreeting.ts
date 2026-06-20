import { useEffect, useState } from "react";

export type DaySegment = "morning" | "afternoon" | "evening" | "night";

export interface GreetingValue {
  /** "Good Morning" | "Good Afternoon" | "Good Evening" | "Good Night". */
  greeting: string;
  segment: DaySegment;
}

interface UseGreetingOptions {
  /** Inject a clock for testing / device-time overrides. Defaults to now. */
  now?: () => Date;
}

const SEGMENT_LABEL: Record<DaySegment, string> = {
  morning: "Good Morning",
  afternoon: "Good Afternoon",
  evening: "Good Evening",
  night: "Good Night",
};

export function segmentForHour(hour: number): DaySegment {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 22) return "evening";
  return "night";
}

/**
 * Time-aware greeting. Re-evaluates on a low-frequency interval (the segment
 * can only change a few times a day) so it costs effectively nothing.
 *
 * Personalization seam: callers pass the name; future phases can layer
 * context-aware copy (calendar, mood, streaks) on top of `segment`.
 */
export function useGreeting({ now = () => new Date() }: UseGreetingOptions = {}): GreetingValue {
  const [segment, setSegment] = useState<DaySegment>(() =>
    segmentForHour(now().getHours()),
  );

  useEffect(() => {
    const id = window.setInterval(
      () => setSegment(segmentForHour(now().getHours())),
      60_000,
    );
    return () => window.clearInterval(id);
  }, [now]);

  return { greeting: SEGMENT_LABEL[segment], segment };
}
