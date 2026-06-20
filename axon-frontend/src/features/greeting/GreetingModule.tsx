import { useAuth } from "@/context/AuthProvider";
import { useGreeting } from "./useGreeting";

/** Shown when no authenticated profile name is available. Configurable. */
const DEFAULT_NAME = "Piyush";

function firstName(full: string | undefined): string {
  const trimmed = full?.trim();
  if (!trimmed) return DEFAULT_NAME;
  return trimmed.split(/\s+/)[0] ?? DEFAULT_NAME;
}

/**
 * Center hero. A calm, time-aware greeting that reads instantly from across the
 * room. The name is the emphasis; the salutation is the quiet lead-in.
 */
export function GreetingModule() {
  const { greeting, segment } = useGreeting();
  const { user } = useAuth();
  const name = firstName(user?.user_metadata?.["full_name"] as string | undefined);

  return (
    <div className="flex items-center justify-center text-center">
      <h1
        key={segment}
        className="text-heading font-light tracking-tight text-content gpu animate-fade-in-up"
      >
        <span className="text-content-muted">{greeting}, </span>
        <strong className="font-semibold text-content">{name}</strong>
      </h1>
    </div>
  );
}
