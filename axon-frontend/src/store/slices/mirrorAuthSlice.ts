import type { StateCreator } from "zustand";
import { clearMirrorAuth } from "@/utils/authToken";
import { readMirrorLinkFromStorage } from "@/utils/mirrorLink";

export interface MirrorAuthSlice {
  mirrorLinked: boolean;
  mirrorUserId: string | null;
  mirrorEmail: string | null;
  mirrorDisplayName: string | null;
  deviceLinkUiActive: boolean;
  hydrateMirrorAuth: () => void;
  applyMirrorLink: (payload: {
    userId: string;
    email: string | null;
    displayName: string | null;
  }) => void;
  clearMirrorLink: () => void;
  setDeviceLinkUiActive: (active: boolean) => void;
}

export const createMirrorAuthSlice: StateCreator<
  MirrorAuthSlice,
  [],
  [],
  MirrorAuthSlice
> = (set) => ({
  ...readMirrorLinkFromStorage(),
  deviceLinkUiActive: false,

  hydrateMirrorAuth: () => {
    set(readMirrorLinkFromStorage());
  },

  applyMirrorLink: ({ userId, email, displayName }) => {
    set({
      mirrorLinked: true,
      mirrorUserId: userId,
      mirrorEmail: email,
      mirrorDisplayName: displayName,
      deviceLinkUiActive: false,
    });
  },

  clearMirrorLink: () => {
    clearMirrorAuth();
    set({
      mirrorLinked: false,
      mirrorUserId: null,
      mirrorEmail: null,
      mirrorDisplayName: null,
      deviceLinkUiActive: false,
    });
  },

  setDeviceLinkUiActive: (active) => set({ deviceLinkUiActive: active }),
});
