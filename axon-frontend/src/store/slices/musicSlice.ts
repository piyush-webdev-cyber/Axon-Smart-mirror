import type { StateCreator } from "zustand";
import type { MusicState } from "@/types/music";

const emptyMusicState: MusicState = {
  current: null,
  queue: [],
  isPlaying: false,
  volume: 70,
  shuffle: false,
  repeatMode: "off",
  positionSec: 0,
  muted: false,
};

export interface MusicSlice {
  music: MusicState;
  musicError: string | null;
  musicVoiceTick: number;
  pendingMusicQuery: string | null;
  showMusicQueue: boolean;
  setMusicState: (state: MusicState) => void;
  setMusicError: (message: string | null) => void;
  setShowMusicQueue: (open: boolean) => void;
  requestMusicVoiceAction: (query?: string | null) => void;
  clearPendingMusicQuery: () => void;
}

export const createMusicSlice: StateCreator<MusicSlice> = (set) => ({
  music: emptyMusicState,
  musicError: null,
  musicVoiceTick: 0,
  pendingMusicQuery: null,
  showMusicQueue: false,
  setMusicState: (music) => set({ music }),
  setMusicError: (musicError) => set({ musicError }),
  setShowMusicQueue: (showMusicQueue) => set({ showMusicQueue }),
  requestMusicVoiceAction: (query) =>
    set((s) => ({
      musicVoiceTick: s.musicVoiceTick + 1,
      pendingMusicQuery: query ?? null,
    })),
  clearPendingMusicQuery: () => set({ pendingMusicQuery: null }),
});
