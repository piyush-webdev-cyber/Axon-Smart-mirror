import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthProvider";
import { ROUTES } from "@/constants/routes";
import { BrandedLoader } from "@/components/common/BrandedLoader";

/**
 * OAuth redirect target. Supabase parses the session from the URL; once the
 * auth state settles we route into the mirror.
 */
export default function CallbackPage() {
  const { loading, session } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading) {
      navigate(session ? ROUTES.home : ROUTES.login, { replace: true });
    }
  }, [loading, session, navigate]);

  return <BrandedLoader label="Signing in" />;
}
