import { create } from "zustand";
import { createThemeSlice, type ThemeSlice } from "./slices/themeSlice";
import {
  createConnectionSlice,
  type ConnectionSlice,
} from "./slices/connectionSlice";
import { createVoiceSlice, type VoiceSlice } from "./slices/voiceSlice";
import { createSystemSlice, type SystemSlice } from "./slices/systemSlice";

/**
 * Root client store, composed from feature slices. Server state lives in
 * TanStack Query, not here, to avoid duplicating remote data.
 *
 * Always read with a selector (e.g. `useAppStore((s) => s.theme)`) to keep
 * re-renders surgical - important for hitting 60 FPS on the Pi.
 */
export type AppStore = ThemeSlice &
  ConnectionSlice &
  VoiceSlice &
  SystemSlice;

export const useAppStore = create<AppStore>()((...args) => ({
  ...createThemeSlice(...args),
  ...createConnectionSlice(...args),
  ...createVoiceSlice(...args),
  ...createSystemSlice(...args),
}));
