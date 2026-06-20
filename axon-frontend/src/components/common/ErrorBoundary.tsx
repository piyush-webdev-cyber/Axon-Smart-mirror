import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Top-level safety net. Catches render-time crashes anywhere in the tree so the
 * mirror degrades gracefully instead of showing a white screen.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  override state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Phase 2: pipe to a remote logging/telemetry service.
    // eslint-disable-next-line no-console
    console.error("[axon] Uncaught render error:", error, info.componentStack);
  }

  private handleReload = (): void => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  override render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-6 p-8 text-center">
        <h1 className="text-fluid-lg font-light tracking-wide">
          Something interrupted Axon
        </h1>
        <p className="max-w-md text-fluid-sm text-muted-foreground">
          An unexpected error occurred. The mirror will recover when you reload.
        </p>
        <Button onClick={this.handleReload}>Reload Axon</Button>
      </div>
    );
  }
}
