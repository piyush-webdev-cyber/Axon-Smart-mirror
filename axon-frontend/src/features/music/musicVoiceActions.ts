/** Execute music voice commands via store + musicApi. */

import type { NavigateFunction } from "react-router-dom";
import { ROUTES } from "@/constants/routes";
import { musicApi } from "@/services/musicApi";
import { useAppStore } from "@/store";
import type { VoiceAction } from "@/types/voiceAssistant";

export async function executeMusicVoiceAction(
  action: VoiceAction,
  navigate: NavigateFunction,
  musicQuery?: string | null,
): Promise<void> {
  const store = useAppStore.getState();

  switch (action) {
    case "open_music":
      navigate(ROUTES.music);
      break;
    case "close_music":
      navigate(ROUTES.home);
      break;
    case "play_music":
      navigate(ROUTES.music);
      store.requestMusicVoiceAction(musicQuery ?? null);
      break;
    case "pause_music":
      await musicApi.pause().then(store.setMusicState).catch(() => undefined);
      break;
    case "resume_music":
      await musicApi.resume().then(store.setMusicState).catch(() => undefined);
      break;
    case "stop_music":
      await musicApi.stop().then(store.setMusicState).catch(() => undefined);
      break;
    case "next_track":
      await musicApi.next().then(store.setMusicState).catch(() => undefined);
      break;
    case "previous_track":
      await musicApi.previous().then(store.setMusicState).catch(() => undefined);
      break;
    case "volume_up":
      await musicApi.volume({ delta: 10 }).then(store.setMusicState).catch(() => undefined);
      break;
    case "volume_down":
      await musicApi.volume({ delta: -10 }).then(store.setMusicState).catch(() => undefined);
      break;
    case "mute_music":
      await musicApi.volume({ mute: true }).then(store.setMusicState).catch(() => undefined);
      break;
    case "unmute_music":
      await musicApi.volume({ mute: false }).then(store.setMusicState).catch(() => undefined);
      break;
    case "shuffle_music":
      await musicApi.shuffle().then(store.setMusicState).catch(() => undefined);
      break;
    case "repeat_music":
      await musicApi.repeat().then(store.setMusicState).catch(() => undefined);
      break;
    default:
      break;
  }
}

const MUSIC_ACTIONS: VoiceAction[] = [
  "open_music",
  "close_music",
  "play_music",
  "pause_music",
  "resume_music",
  "stop_music",
  "next_track",
  "previous_track",
  "volume_up",
  "volume_down",
  "mute_music",
  "unmute_music",
  "shuffle_music",
  "repeat_music",
];

export function isMusicVoiceAction(action: VoiceAction): boolean {
  return Boolean(action && MUSIC_ACTIONS.includes(action));
}
