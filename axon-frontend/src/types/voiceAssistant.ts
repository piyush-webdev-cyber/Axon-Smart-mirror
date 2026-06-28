/**
 * Voice action types returned by the AI / command router.
 */
export type VoiceAction =
  | "open_camera"
  | "close_camera"
  | "open_gallery"
  | "open_interview"
  | "open_music"
  | "close_music"
  | "play_music"
  | "pause_music"
  | "resume_music"
  | "stop_music"
  | "next_track"
  | "previous_track"
  | "volume_up"
  | "volume_down"
  | "mute_music"
  | "unmute_music"
  | "shuffle_music"
  | "repeat_music"
  | "go_home"
  | "open_settings"
  | "open_weather"
  | "refresh_weather"
  | "take_photo"
  | "show_gallery_qr"
  | "delete_photo"
  | "logout"
  | null;

export interface VoiceProcessResult {
  reply: string;
  action: VoiceAction;
  musicQuery?: string | null;
  source?: string;
}
