import { useAuth } from "@/context/AuthProvider";

/**
 * Center stage content for the mirror home view. Intentionally minimal and
 * calm - the dynamic content area that future features (coach, interview,
 * music, photos) will render into.
 */
export default function HomePage() {
  const { user } = useAuth();
  const name = user?.user_metadata?.["full_name"] as string | undefined;

  return (
    <section className="flex flex-col items-center gap-4 text-center animate-fade-in">
      <p className="text-fluid-sm font-light uppercase tracking-[0.6em] text-muted-foreground">
        Good to see you
      </p>
      <h1 className="text-fluid-xl font-extralight tracking-tight text-glow">
        {name ?? "Axon"}
      </h1>
      <p className="max-w-md text-fluid-base font-light text-muted-foreground">
        Your intelligent mirror is ready.
      </p>
    </section>
  );
}
