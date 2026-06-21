import type { StateCreator } from "zustand";

export type CameraState =
  | "idle"
  | "countdown"
  | "capturing"
  | "uploading"
  | "success"
  | "error";

export interface CameraSlice {
  cameraState: CameraState;
  pendingVoiceCapture: boolean;
  galleryQrTick: number;
  deletePhotoTick: number;
  setCameraState: (state: CameraState) => void;
  requestPhotoCapture: () => void;
  clearPendingVoiceCapture: () => void;
  requestGalleryQr: () => void;
  requestPhotoDelete: () => void;
}

export const createCameraSlice: StateCreator<CameraSlice> = (set) => ({
  cameraState: "idle",
  pendingVoiceCapture: false,
  galleryQrTick: 0,
  deletePhotoTick: 0,
  setCameraState: (cameraState) => set({ cameraState }),
  requestPhotoCapture: () => set({ pendingVoiceCapture: true }),
  clearPendingVoiceCapture: () => set({ pendingVoiceCapture: false }),
  requestGalleryQr: () =>
    set((state) => ({ galleryQrTick: state.galleryQrTick + 1 })),
  requestPhotoDelete: () =>
    set((state) => ({ deletePhotoTick: state.deletePhotoTick + 1 })),
});
