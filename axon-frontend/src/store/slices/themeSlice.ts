import type { StateCreator } from "zustand";
import {
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  type ThemeName,
} from "@/constants/themes";

export interface ThemeSlice {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
}

function persist(theme: ThemeName): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* storage may be unavailable in kiosk/incognito; ignore */
  }
}

function applyToDocument(theme: ThemeName): void {
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-theme", theme);
  }
}

function readInitial(): ThemeName {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored) return stored as ThemeName;
  } catch {
    /* ignore */
  }
  return DEFAULT_THEME;
}

export const createThemeSlice: StateCreator<ThemeSlice, [], [], ThemeSlice> = (
  set,
) => ({
  theme: readInitial(),
  setTheme: (theme) => {
    applyToDocument(theme);
    persist(theme);
    set({ theme });
  },
});
