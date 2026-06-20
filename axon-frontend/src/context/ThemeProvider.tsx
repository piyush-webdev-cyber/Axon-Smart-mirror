import { useEffect, type ReactNode } from "react";
import { useAppStore } from "@/store";
import type { ThemeName } from "@/constants/themes";

/**
 * Applies the active theme to the document on mount and whenever it changes.
 * Theme state itself lives in the Zustand `themeSlice` (persisted to storage,
 * and in Phase 2 synced to the user's `settings.theme`).
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useAppStore((s) => s.theme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  return <>{children}</>;
}

export function useTheme(): {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
} {
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  return { theme, setTheme };
}
