/** Music mode types (YouTube-backed, provider-agnostic shape). */

export interface MusicTrack {
  videoId: string;
  title: string;
  artist: string;
  thumbnailUrl: string | null;
  durationSec: number;
}

export type RepeatMode = "off" | "one" | "all";

export interface MusicState {
  current: MusicTrack | null;
  queue: MusicTrack[];
  isPlaying: boolean;
  volume: number;
  shuffle: boolean;
  repeatMode: RepeatMode;
  positionSec: number;
  muted: boolean;
}

export interface MusicHistoryEntry {
  id: string;
  videoId: string;
  title: string;
  artist: string;
  thumbnailUrl: string | null;
  durationSec: number;
  playedAt: string;
}

export interface MusicPlaylist {
  id: string;
  name: string;
  playlistType: string;
  tracks: MusicTrack[];
}

export function normalizeTrack(raw: Record<string, unknown>): MusicTrack {
  return {
    videoId: String(raw.videoId ?? raw.video_id ?? ""),
    title: String(raw.title ?? "Unknown"),
    artist: String(raw.artist ?? ""),
    thumbnailUrl: (raw.thumbnailUrl ?? raw.thumbnail_url ?? null) as string | null,
    durationSec: Number(raw.durationSec ?? raw.duration_sec ?? 0),
  };
}

export function normalizeMusicState(raw: Record<string, unknown>): MusicState {
  const currentRaw = raw.current as Record<string, unknown> | null | undefined;
  const queueRaw = (raw.queue as Record<string, unknown>[] | undefined) ?? [];
  return {
    current: currentRaw ? normalizeTrack(currentRaw) : null,
    queue: queueRaw.map(normalizeTrack),
    isPlaying: Boolean(raw.isPlaying ?? raw.is_playing),
    volume: Number(raw.volume ?? 70),
    shuffle: Boolean(raw.shuffle),
    repeatMode: (raw.repeatMode ?? raw.repeat_mode ?? "off") as RepeatMode,
    positionSec: Number(raw.positionSec ?? raw.position_sec ?? 0),
    muted: Boolean(raw.muted),
  };
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}
