/**
 * Theme registry. The default `black-mirror` theme is the only fully styled
 * theme in Phase 1; the rest are reserved token sets that future phases flesh
 * out in src/styles/themes.css. Adding a theme requires no component changes.
 */
export const THEMES = [
  "black-mirror",
  "dark",
  "light",
  "glass",
  "cyber",
  "minimal",
] as const;

export type ThemeName = (typeof THEMES)[number];

export const DEFAULT_THEME: ThemeName = "black-mirror";

export const THEME_STORAGE_KEY = "axon.theme";

export const THEME_LABELS: Record<ThemeName, string> = {
  "black-mirror": "Black Mirror",
  dark: "Dark",
  light: "Light",
  glass: "Glass",
  cyber: "Cyber",
  minimal: "Minimal",
};
