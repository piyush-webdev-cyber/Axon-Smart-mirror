/** Execute voice command actions via React Router and store triggers. */

import type { NavigateFunction } from "react-router-dom";
import { ROUTES } from "@/constants/routes";
import { executeMusicVoiceAction, isMusicVoiceAction } from "@/features/music/musicVoiceActions";
import { useAppStore } from "@/store";
import type { VoiceAction, VoiceProcessResult } from "@/types/voiceAssistant";

export function executeVoiceAction(
  action: VoiceAction,
  navigate: NavigateFunction,
  musicQuery?: string | null,
): void {
  if (!action) return;

  if (isMusicVoiceAction(action)) {
    void executeMusicVoiceAction(action, navigate, musicQuery);
    return;
  }

  const store = useAppStore.getState();

  switch (action) {
    case "open_camera":
      navigate(ROUTES.camera);
      break;
    case "take_photo":
      navigate(ROUTES.camera);
      store.requestPhotoCapture();
      break;
    case "open_gallery":
      navigate(ROUTES.gallery);
      break;
    case "show_gallery_qr":
      navigate(`${ROUTES.gallery}?qr=1`);
      store.requestGalleryQr();
      break;
    case "delete_photo":
      navigate(ROUTES.gallery);
      store.requestPhotoDelete();
      break;
    case "open_interview":
      navigate(ROUTES.home);
      break;
    case "go_home":
      navigate(ROUTES.home);
      break;
    default:
      break;
  }
}

export function executeVoiceResult(result: VoiceProcessResult, navigate: NavigateFunction): void {
  executeVoiceAction(result.action, navigate, result.musicQuery ?? null);
}
