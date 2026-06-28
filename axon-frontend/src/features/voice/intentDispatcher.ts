/**
 * Command Dispatcher — the ONLY entry point that invokes mirror features from voice.
 */

import type { NavigateFunction } from "react-router-dom";
import { ROUTES } from "@/constants/routes";
import { executeMusicVoiceAction } from "@/features/music/musicVoiceActions";
import { MirrorIntent, type IntentPayload } from "@/features/voice/intentEngine";
import { logVoiceDispatch } from "@/features/voice/voiceLogger";
import {
  getCompletedStatus,
  getExecutionStatus,
} from "@/features/voice/voiceStatusMessages";
import {
  setVoiceCompletedPhase,
  setVoiceExecutingPhase,
} from "@/features/voice/voiceSpeechBridge";
import { supabase } from "@/services/supabaseClient";
import { queryClient } from "@/services/queryClient";
import type { VoiceAction } from "@/types/voiceAssistant";
import { useAppStore } from "@/store";

function invalidateWeatherQueries(): void {
  void queryClient.invalidateQueries({ queryKey: ["weather"] });
}

/** Map canonical intent → legacy voice action consumed by feature modules. */
export function intentToVoiceAction(intent: MirrorIntent): VoiceAction {
  switch (intent) {
    case MirrorIntent.OPEN_HOME:
    case MirrorIntent.HOME:
      return "go_home";
    case MirrorIntent.OPEN_CAMERA:
      return "open_camera";
    case MirrorIntent.CLOSE_CAMERA:
      return "close_camera";
    case MirrorIntent.TAKE_PHOTO:
      return "take_photo";
    case MirrorIntent.OPEN_GALLERY:
      return "open_gallery";
    case MirrorIntent.SHOW_MY_PHOTOS:
    case MirrorIntent.GIVE_ME_MY_PHOTOS:
      return "show_gallery_qr";
    case MirrorIntent.DELETE_LAST_PHOTO:
      return "delete_photo";
    case MirrorIntent.OPEN_INTERVIEW:
      return "open_interview";
    case MirrorIntent.OPEN_SETTINGS:
      return "open_settings";
    case MirrorIntent.PLAY_MUSIC:
    case MirrorIntent.PLAY_SPECIFIC_SONG:
      return "play_music";
    case MirrorIntent.PAUSE_MUSIC:
      return "pause_music";
    case MirrorIntent.RESUME_MUSIC:
      return "resume_music";
    case MirrorIntent.STOP_MUSIC:
      return "stop_music";
    case MirrorIntent.NEXT_SONG:
      return "next_track";
    case MirrorIntent.PREVIOUS_SONG:
      return "previous_track";
    case MirrorIntent.VOLUME_UP:
      return "volume_up";
    case MirrorIntent.VOLUME_DOWN:
      return "volume_down";
    case MirrorIntent.MUTE:
      return "mute_music";
    case MirrorIntent.UNMUTE:
      return "unmute_music";
    case MirrorIntent.SHOW_WEATHER:
      return "open_weather";
    case MirrorIntent.REFRESH_WEATHER:
      return "refresh_weather";
    case MirrorIntent.SHOW_TIME:
    case MirrorIntent.SHOW_DATE:
    case MirrorIntent.LOGOUT:
    case MirrorIntent.UNKNOWN:
    default:
      return null;
  }
}

const MUSIC_INTENTS = new Set<MirrorIntent>([
  MirrorIntent.PLAY_MUSIC,
  MirrorIntent.PLAY_SPECIFIC_SONG,
  MirrorIntent.PAUSE_MUSIC,
  MirrorIntent.RESUME_MUSIC,
  MirrorIntent.STOP_MUSIC,
  MirrorIntent.NEXT_SONG,
  MirrorIntent.PREVIOUS_SONG,
  MirrorIntent.VOLUME_UP,
  MirrorIntent.VOLUME_DOWN,
  MirrorIntent.MUTE,
  MirrorIntent.UNMUTE,
]);

/**
 * Execute a matched offline intent. All voice-driven feature calls go through here.
 */
export function executeIntent(
  intent: MirrorIntent,
  navigate: NavigateFunction,
  payload: IntentPayload = {},
): void {
  const started = performance.now();

  if (intent === MirrorIntent.UNKNOWN) {
    logVoiceDispatch(intent, Math.round(performance.now() - started));
    return;
  }

  setVoiceExecutingPhase(intent, getExecutionStatus(intent));

  if (intent === MirrorIntent.LOGOUT) {
    const store = useAppStore.getState();
    void (async () => {
      store.clearMirrorLink();
      await supabase.auth.signOut();
      navigate(ROUTES.login);
    })();
    logVoiceDispatch(intent, Math.round(performance.now() - started));
    setVoiceCompletedPhase(getCompletedStatus(intent));
    return;
  }

  const action = intentToVoiceAction(intent);

  if (action && MUSIC_INTENTS.has(intent)) {
    void executeMusicVoiceAction(action, navigate, payload.musicQuery ?? null);
    logVoiceDispatch(intent, Math.round(performance.now() - started));
    setVoiceCompletedPhase(getCompletedStatus(intent));
    return;
  }

  const store = useAppStore.getState();

  switch (intent) {
    case MirrorIntent.OPEN_HOME:
    case MirrorIntent.HOME:
      navigate(ROUTES.home);
      break;
    case MirrorIntent.OPEN_CAMERA:
      navigate(ROUTES.camera);
      break;
    case MirrorIntent.CLOSE_CAMERA:
      navigate(ROUTES.home);
      break;
    case MirrorIntent.TAKE_PHOTO:
      navigate(ROUTES.camera);
      store.requestPhotoCapture();
      break;
    case MirrorIntent.OPEN_GALLERY:
      navigate(ROUTES.gallery);
      break;
    case MirrorIntent.SHOW_MY_PHOTOS:
    case MirrorIntent.GIVE_ME_MY_PHOTOS:
      navigate(`${ROUTES.gallery}?qr=1`);
      store.requestGalleryQr();
      break;
    case MirrorIntent.DELETE_LAST_PHOTO:
      navigate(ROUTES.gallery);
      store.requestPhotoDelete();
      break;
    case MirrorIntent.OPEN_INTERVIEW:
      navigate(ROUTES.home);
      break;
    case MirrorIntent.OPEN_SETTINGS:
      navigate(ROUTES.settings);
      break;
    case MirrorIntent.SHOW_WEATHER:
      navigate(ROUTES.home);
      invalidateWeatherQueries();
      break;
    case MirrorIntent.REFRESH_WEATHER:
      navigate(ROUTES.home);
      invalidateWeatherQueries();
      break;
    case MirrorIntent.SHOW_TIME:
    case MirrorIntent.SHOW_DATE:
      break;
    default:
      break;
  }

  logVoiceDispatch(intent, Math.round(performance.now() - started));
  setVoiceCompletedPhase(getCompletedStatus(intent));
}

export function voiceActionToIntent(action: VoiceAction): MirrorIntent {
  if (!action) return MirrorIntent.UNKNOWN;
  const map: Partial<Record<NonNullable<VoiceAction>, MirrorIntent>> = {
    go_home: MirrorIntent.OPEN_HOME,
    open_camera: MirrorIntent.OPEN_CAMERA,
    close_camera: MirrorIntent.CLOSE_CAMERA,
    take_photo: MirrorIntent.TAKE_PHOTO,
    open_gallery: MirrorIntent.OPEN_GALLERY,
    show_gallery_qr: MirrorIntent.GIVE_ME_MY_PHOTOS,
    delete_photo: MirrorIntent.DELETE_LAST_PHOTO,
    open_interview: MirrorIntent.OPEN_INTERVIEW,
    open_settings: MirrorIntent.OPEN_SETTINGS,
    open_music: MirrorIntent.PLAY_MUSIC,
    play_music: MirrorIntent.PLAY_MUSIC,
    pause_music: MirrorIntent.PAUSE_MUSIC,
    resume_music: MirrorIntent.RESUME_MUSIC,
    stop_music: MirrorIntent.STOP_MUSIC,
    next_track: MirrorIntent.NEXT_SONG,
    previous_track: MirrorIntent.PREVIOUS_SONG,
    volume_up: MirrorIntent.VOLUME_UP,
    volume_down: MirrorIntent.VOLUME_DOWN,
    mute_music: MirrorIntent.MUTE,
    unmute_music: MirrorIntent.UNMUTE,
    open_weather: MirrorIntent.SHOW_WEATHER,
    refresh_weather: MirrorIntent.REFRESH_WEATHER,
    logout: MirrorIntent.LOGOUT,
  };
  return map[action] ?? MirrorIntent.UNKNOWN;
}

export function isImmediateIntent(intent: MirrorIntent): boolean {
  if (intent === MirrorIntent.UNKNOWN) return false;
  if (intent === MirrorIntent.SHOW_TIME || intent === MirrorIntent.SHOW_DATE) return false;
  return true;
}
