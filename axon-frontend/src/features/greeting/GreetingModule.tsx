import { useAuth } from "@/context/AuthProvider";
import { useMirrorAuth } from "@/hooks/useMirrorAuth";
import { useGreeting } from "./useGreeting";

const DEFAULT_NAME = "Guest";

function firstName(full: string | undefined): string {
  const trimmed = full?.trim();
  if (!trimmed) return DEFAULT_NAME;
  return trimmed.split(/\s+/)[0] ?? DEFAULT_NAME;
}

export function GreetingModule() {
  const { greeting, segment } = useGreeting();
  const { user } = useAuth();
  const { displayName: mirrorDisplayName, email: mirrorEmail } = useMirrorAuth();

  const name = user
    ? firstName(user.user_metadata?.["full_name"] as string | undefined)
    : firstName(mirrorDisplayName ?? mirrorEmail?.split("@")[0] ?? undefined);

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
