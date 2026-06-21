import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "@/context/AuthProvider";
import { ROUTES } from "@/constants/routes";
import { BrandedLoader } from "@/components/common/BrandedLoader";
import { isMirrorLinked } from "@/utils/authToken";

/**
 * Guards camera/gallery/settings. Accepts Supabase session or a linked mirror token.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) return <BrandedLoader label="Axon" />;
  if (!session && !isMirrorLinked()) {
    return <Navigate to={ROUTES.login} replace state={{ from: location }} />;
  }
  return <>{children}</>;
}
