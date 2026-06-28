/**
 * Voice action types returned by the AI / command router.
 */
export type VoiceAction =
  | "open_camera"
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
  | "take_photo"
  | "show_gallery_qr"
  | "delete_photo"
  | null;

export interface VoiceProcessResult {
  reply: string;
  action: VoiceAction;
  musicQuery?: string | null;
  source?: string;
}
