import { useState, type FormEvent } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthProvider";
import { useToast } from "@/context/ToastProvider";

/**
 * Authentication entry point. Supports Google OAuth and email/password via
 * Supabase Auth. Styled to match the premium mirror aesthetic.
 */
export default function LoginPage() {
  const { signInWithGoogle, signInWithEmail } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const handleEmailLogin = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await signInWithEmail(email, password);
    } catch (err) {
      toast({
        title: "Sign-in failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full w-full items-center justify-center p-6">
      <Card className="w-full max-w-sm animate-fade-in">
        <CardHeader>
          <CardTitle className="text-center text-fluid-lg font-extralight tracking-[0.4em] uppercase text-glow">
            Axon
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Button variant="outline" onClick={() => void signInWithGoogle()}>
            Continue with Google
          </Button>

          <div className="flex items-center gap-3 text-fluid-sm text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or
            <span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleEmailLogin} className="flex flex-col gap-3">
            <input
              type="email"
              required
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-md border border-input bg-secondary/40 px-3 py-2 text-fluid-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <input
              type="password"
              required
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-md border border-input bg-secondary/40 px-3 py-2 text-fluid-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <Button type="submit" disabled={busy}>
              {busy ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
