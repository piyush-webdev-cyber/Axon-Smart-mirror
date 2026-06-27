/** Phone linking page (/link/:code). */

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { BrandedLoader } from "@/components/common/BrandedLoader";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthProvider";
import { deviceApi, DeviceApiError } from "@/services/deviceApi";
import { supabase } from "@/services/supabaseClient";

type LinkPhase = "boot" | "sign_in" | "linking" | "success" | "error";

function normalizeDeviceCode(raw: string | undefined): string | null {
  if (!raw) return null;
  return raw.trim().toUpperCase();
}

export default function LinkPage() {
  const { code: rawCode } = useParams<{ code: string }>();
  const code = normalizeDeviceCode(rawCode);
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();

  const [phase, setPhase] = useState<LinkPhase>("boot");
  const [error, setError] = useState<string | null>(null);
  const [signInBusy, setSignInBusy] = useState(false);
  const linkStarted = useRef(false);

  useEffect(() => {
    if (rawCode && code && rawCode !== code) {
      navigate(`/link/${code}`, { replace: true });
    }
    // OAuth redirect may leave a hash fragment — strip it so routing stays clean.
    if (window.location.hash && window.location.hash.includes("access_token")) {
      const clean = window.location.pathname + window.location.search;
      window.history.replaceState(null, "", clean);
    }
  }, [rawCode, code, navigate]);

  const linkDevice = useCallback(async () => {
    if (!code) return;

    setPhase("linking");
    setError(null);

    try {
      const {
        data: { session: freshSession },
      } = await supabase.auth.getSession();

      if (!freshSession?.access_token) {
        throw new Error("Your sign-in session expired. Please sign in again.");
      }

      try {
        await deviceApi.linkDevice(code, freshSession.access_token);
      } catch (linkErr) {
        const alreadyLinked =
          linkErr instanceof DeviceApiError &&
          linkErr.status === 400 &&
          linkErr.message.toLowerCase().includes("already linked");
        if (!alreadyLinked) {
          throw linkErr;
        }
      }

      const status = await deviceApi.checkDeviceStatus(code);
      if (status.mirror_token && status.user_id) {
        sessionStorage.setItem(
          "axon_last_link_payload",
          JSON.stringify({
            code,
            userId: status.user_id,
            mirrorToken: status.mirror_token,
            email: status.email,
            displayName: status.display_name,
          }),
        );
      }

      localStorage.removeItem("axon_pending_link_code");
      setPhase("success");
    } catch (err) {
      console.error("Link error:", err);
      setError(err instanceof Error ? err.message : "Failed to link device");
      setPhase("error");
    }
  }, [code]);

  useEffect(() => {
    if (authLoading || !code) return;

    // Parse OAuth tokens from hash when Supabase redirects back to /link/:code
    if (window.location.hash.includes("access_token")) {
      void supabase.auth.getSession();
    }

    if (session) {
      if (!linkStarted.current) {
        linkStarted.current = true;
        void linkDevice();
      }
    } else {
      setPhase("sign_in");
    }
  }, [authLoading, code, session, linkDevice]);

  const handleGoogleSignIn = async () => {
    if (!code) return;

    try {
      setSignInBusy(true);
      setError(null);
      localStorage.setItem("axon_pending_link_code", code);

      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/link/${code}`,
        },
      });

      if (signInError) throw signInError;
    } catch (err) {
      console.error("Sign in error:", err);
      setError("Could not start Google sign-in. Please try again.");
      setSignInBusy(false);
    }
  };

  const handleRetry = () => {
    linkStarted.current = false;
    void linkDevice();
  };

  if (!code) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="glass-surface w-full max-w-md p-8 text-center">
          <h1 className="mb-2 text-heading font-semibold text-error">Invalid link</h1>
          <p className="text-body text-text-secondary">
            This device code is missing or invalid. Scan the QR code on your mirror again.
          </p>
        </div>
      </div>
    );
  }

  if (phase === "boot" || authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <BrandedLoader label="Loading" />
      </div>
    );
  }

  if (phase === "linking") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <BrandedLoader label="Linking your mirror" />
      </div>
    );
  }

  if (phase === "success") {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="glass-surface w-full max-w-md p-8 text-center">
          <div className="mb-4 text-4xl">✓</div>
          <h1 className="mb-2 text-heading font-semibold text-glow">Mirror connected</h1>
          <p className="mb-2 text-body text-text-secondary">
            Your Axon mirror is now linked to your account.
          </p>
          <p className="text-caption text-text-secondary">
            You can close this page — the mirror will update automatically.
          </p>
        </div>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="glass-surface w-full max-w-md p-8 text-center">
          <h1 className="mb-2 text-heading font-semibold text-error">Could not link</h1>
          <p className="mb-6 text-body text-text-secondary">
            {error ?? "Something went wrong while linking your mirror."}
          </p>
          <div className="mb-6 rounded-lg bg-surface p-4">
            <div className="text-caption text-text-secondary">Device code</div>
            <div className="text-display-lg font-bold tracking-wider text-primary">{code}</div>
          </div>
          <div className="flex flex-col gap-3">
            <Button onClick={handleRetry}>Try again</Button>
            <Button variant="outline" onClick={() => void handleGoogleSignIn()} disabled={signInBusy}>
              {signInBusy ? "Redirecting…" : "Sign in with a different account"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="glass-surface w-full max-w-md p-8 text-center">
        <h1 className="mb-2 text-heading font-semibold text-glow">Connect to Axon</h1>
        <p className="mb-8 text-body text-text-secondary">Sign in to link your mirror</p>

        <div className="mb-8 rounded-lg bg-surface p-4">
          <div className="text-caption text-text-secondary">Device code</div>
          <div className="text-display-lg font-bold tracking-wider text-primary">{code}</div>
        </div>

        <Button
          className="w-full py-6 text-lg"
          onClick={() => void handleGoogleSignIn()}
          disabled={signInBusy}
        >
          {signInBusy ? "Redirecting to Google…" : "Continue with Google"}
        </Button>

        {error && (
          <div className="mt-4 rounded-lg bg-error/10 p-3 text-sm text-error">{error}</div>
        )}

        <p className="mt-6 text-caption text-text-secondary">
          By connecting, you agree to link this device to your Axon account.
        </p>
      </div>
    </div>
  );
}
