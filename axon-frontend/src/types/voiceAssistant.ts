/**
 * Voice action types returned by the AI / command router.
 */
export type VoiceAction =
  | "open_camera"
  | "open_gallery"
  | "open_interview"
  | "play_music"
  | "go_home"
  | "take_photo"
  | "show_gallery_qr"
  | "delete_photo"
  | null;

export interface VoiceProcessResult {
  reply: string;
  action: VoiceAction;
  source?: string;
}
