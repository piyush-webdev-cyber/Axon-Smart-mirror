/** Execute voice command actions via React Router and store triggers. */

import type { NavigateFunction } from "react-router-dom";
import { ROUTES } from "@/constants/routes";
import { useAppStore } from "@/store";
import type { VoiceAction } from "@/types/voiceAssistant";

export function executeVoiceAction(action: VoiceAction, navigate: NavigateFunction): void {
  if (!action) return;

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
    case "play_music":
      break;
    default:
      break;
  }
}
