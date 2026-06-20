import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/utils/cn";

type ToastVariant = "default" | "success" | "error";

interface Toast {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toast: (input: Omit<Toast, "id" | "variant"> & {
    variant?: ToastVariant;
  }) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const VARIANT_STYLES: Record<ToastVariant, string> = {
  default: "border-border/50 bg-card/70",
  success: "border-primary/40 bg-primary/15",
  error: "border-destructive/40 bg-destructive/15",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback<ToastContextValue["toast"]>(
    ({ title, description, variant = "default" }) => {
      const id = crypto.randomUUID();
      const next: Toast = { id, title, variant };
      if (description) next.description = description;
      setToasts((prev) => [...prev, next]);
      window.setTimeout(() => dismiss(id), 4000);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex w-80 max-w-[90vw] flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto rounded-lg border p-4 backdrop-blur-xl animate-fade-in",
              VARIANT_STYLES[t.variant],
            )}
            role="status"
          >
            <p className="text-fluid-sm font-medium">{t.title}</p>
            {t.description ? (
              <p className="mt-1 text-fluid-sm text-muted-foreground">
                {t.description}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
