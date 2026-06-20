export type FocusSource = "static" | "ai" | "user";

export interface DailyFocus {
  /** The headline goal for the day. */
  title: string;
  /** Optional supporting line (a "why" or sub-task). */
  detail?: string;
  /** Where this focus came from - lets the UI badge AI-generated goals later. */
  source: FocusSource;
}

export interface UseDailyFocusResult {
  focus: DailyFocus;
}

/**
 * Daily Focus data seam.
 *
 * Phase 2: a single static focus. The shape is intentionally future-proof - a
 * later phase returns an AI-generated `DailyFocus` (source: "ai") from the
 * backend with no change to the card UI.
 */
export function useDailyFocus(): UseDailyFocusResult {
  return {
    focus: {
      title: "Build Axon Smart Mirror",
      source: "static",
    },
  };
}
