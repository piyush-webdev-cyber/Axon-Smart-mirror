import { Sparkles, Target } from "lucide-react";
import { useDailyFocus } from "./useDailyFocus";

/**
 * Center region, beneath the greeting. A single, calm intention for the day.
 * Rendered as a floating glass pill rather than a dashboard card - the focus is
 * the words, not the container.
 */
export function DailyFocusCard() {
  const { focus } = useDailyFocus();
  const isAi = focus.source === "ai";

  return (
    <div className="flex justify-center animate-fade-in-up [animation-delay:120ms] opacity-0">
      <div className="glass-surface flex max-w-[min(90vw,30rem)] items-center gap-3 rounded-[1.3rem] px-[clamp(1rem,1.6vw,1.5rem)] py-[clamp(0.65rem,1.1vw,0.95rem)]">
        <span
          aria-hidden
          className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-muted/70"
        >
          {isAi ? (
            <Sparkles className="size-4 text-content" strokeWidth={1.5} />
          ) : (
            <Target className="size-4 text-content" strokeWidth={1.5} />
          )}
        </span>

        <div className="flex flex-col text-left">
          <span className="text-caption uppercase tracking-[0.18em] text-content-muted">
            Today&apos;s Focus
          </span>
          <span className="text-heading font-light text-content">
            {focus.title}
          </span>
          {focus.detail && (
            <span className="mt-0.5 text-body font-light text-content-muted">
              {focus.detail}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
