import { create } from "zustand";
import { createThemeSlice, type ThemeSlice } from "./slices/themeSlice";
import {
  createConnectionSlice,
  type ConnectionSlice,
} from "./slices/connectionSlice";
import { createVoiceSlice, type VoiceSlice } from "./slices/voiceSlice";
import { createSystemSlice, type SystemSlice } from "./slices/systemSlice";
import { createCameraSlice, type CameraSlice } from "./slices/cameraSlice";
import { createMirrorAuthSlice, type MirrorAuthSlice } from "./slices/mirrorAuthSlice";

export type AppStore = ThemeSlice &
  ConnectionSlice &
  VoiceSlice &
  SystemSlice &
  CameraSlice &
  MirrorAuthSlice;

export const useAppStore = create<AppStore>()((...args) => ({
  ...createThemeSlice(...args),
  ...createConnectionSlice(...args),
  ...createVoiceSlice(...args),
  ...createSystemSlice(...args),
  ...createCameraSlice(...args),
  ...createMirrorAuthSlice(...args),
}));
