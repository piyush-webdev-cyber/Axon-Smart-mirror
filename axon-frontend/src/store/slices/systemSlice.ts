import type { StateCreator } from "zustand";

export interface SystemSlice {
  /** Whether the immersive mirror chrome is active (kiosk mode). */
  mirrorMode: boolean;
  bootedAt: number;
  setMirrorMode: (active: boolean) => void;
}

export const createSystemSlice: StateCreator<
  SystemSlice,
  [],
  [],
  SystemSlice
> = (set) => ({
  mirrorMode: true,
  bootedAt: Date.now(),
  setMirrorMode: (mirrorMode) => set({ mirrorMode }),
});
