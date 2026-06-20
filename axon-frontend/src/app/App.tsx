import { RouterProvider } from "react-router-dom";
import { AppProviders } from "./providers";
import { router } from "./router";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { OfflineBanner } from "@/components/common/OfflineBanner";
import { GlobalEffects } from "./GlobalEffects";

/**
 * Application root. ErrorBoundary wraps everything so any crash degrades
 * gracefully; GlobalEffects wires app-wide side effects (WebSocket, online
 * status) inside the provider tree.
 */
export function App() {
  return (
    <ErrorBoundary>
      <AppProviders>
        <GlobalEffects />
        <OfflineBanner />
        <RouterProvider router={router} />
      </AppProviders>
    </ErrorBoundary>
  );
}
