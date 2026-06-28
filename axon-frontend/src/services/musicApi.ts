/** Music API client — Phase 6 Smart Music Mode. */

import type { MusicHistoryEntry, MusicPlaylist, MusicState, MusicTrack } from "@/types/music";
import { normalizeMusicState, normalizeTrack } from "@/types/music";
import { getAuthHeaders } from "@/utils/authToken";
import { restApiBase } from "@/utils/restApiBase";

function parseError(body: unknown, fallback: string, status?: number): string {
  if (typeof body === "object" && body) {
    const record = body as {
      error?: { message?: string; code?: string };
      detail?: string;
    };
    const code = record.error?.code;
    const message = record.error?.message;
    if (code === "http_error" && message === "Not Found" && status === 404) {
      return "Music API not found. Restart Electron — it will auto-pick port 8011 if 8010 is stuck.";
    }
    if (code === "not_found" && message) return message;
    if (record.error?.message) return record.error.message;
    if (typeof record.detail === "string") return record.detail;
  }
  if (status === 401) return "Sign in or link your phone to use music.";
  return fallback;
}

async function musicFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = await getAuthHeaders();
  return fetch(`${restApiBase()}${path}`, {
    ...init,
    headers: { ...headers, ...(init.headers as Record<string, string> | undefined) },
  });
}

async function parseState(response: Response): Promise<MusicState> {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(parseError(body, "Music request failed", response.status));
  }
  const raw = (await response.json()) as Record<string, unknown>;
  return normalizeMusicState(raw);
}

export const musicApi = {
  async getState(): Promise<MusicState> {
    return parseState(await musicFetch("/music/state"));
  },

  async search(q: string): Promise<{ query: string; tracks: MusicTrack[] }> {
    const response = await musicFetch(`/music/search?q=${encodeURIComponent(q)}`);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(parseError(body, "Search failed"));
    }
    const raw = (await response.json()) as Record<string, unknown>;
    const tracks = ((raw.tracks as Record<string, unknown>[]) ?? []).map(normalizeTrack);
    return { query: String(raw.query ?? q), tracks };
  },

  async play(options: { query?: string; videoId?: string; track?: MusicTrack } = {}) {
    const response = await musicFetch("/music/play", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: options.query,
        videoId: options.videoId,
        track: options.track
          ? {
              video_id: options.videoId ?? options.track.videoId,
              title: options.track.title,
              artist: options.track.artist,
              thumbnail_url: options.track.thumbnailUrl,
              duration_sec: options.track.durationSec,
            }
          : undefined,
      }),
    });
    return parseState(response);
  },

  pause: async () => parseState(await musicFetch("/music/pause", { method: "POST" })),
  resume: async () => parseState(await musicFetch("/music/resume", { method: "POST" })),
  stop: async () => parseState(await musicFetch("/music/stop", { method: "POST" })),
  next: async () => parseState(await musicFetch("/music/next", { method: "POST" })),
  previous: async () => parseState(await musicFetch("/music/previous", { method: "POST" })),
  shuffle: async () => parseState(await musicFetch("/music/shuffle", { method: "POST" })),
  repeat: async () => parseState(await musicFetch("/music/repeat", { method: "POST" })),
  finished: async () => parseState(await musicFetch("/music/finished", { method: "POST" })),

  async volume(options: { volume?: number; delta?: number; mute?: boolean }) {
    return parseState(
      await musicFetch("/music/volume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(options),
      }),
    );
  },

  async seek(positionSec: number) {
    return parseState(
      await musicFetch("/music/seek", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ positionSec }),
      }),
    );
  },

  async getHistory(): Promise<{ items: MusicHistoryEntry[]; total: number }> {
    const response = await musicFetch("/music/history");
    if (!response.ok) throw new Error("Failed to load history");
    const raw = (await response.json()) as {
      items: Array<Record<string, unknown>>;
      total: number;
    };
    return {
      total: raw.total,
      items: (raw.items ?? []).map((item) => ({
        id: String(item.id),
        videoId: String(item.videoId ?? item.video_id),
        title: String(item.title),
        artist: String(item.artist ?? ""),
        thumbnailUrl: (item.thumbnailUrl ?? item.thumbnail_url ?? null) as string | null,
        durationSec: Number(item.durationSec ?? item.duration_sec ?? 0),
        playedAt: String(item.playedAt ?? item.played_at),
      })),
    };
  },

  async getPlaylists(): Promise<MusicPlaylist[]> {
    const response = await musicFetch("/music/playlists");
    if (!response.ok) throw new Error("Failed to load playlists");
    const raw = (await response.json()) as { playlists: Array<Record<string, unknown>> };
    return (raw.playlists ?? []).map((p) => ({
      id: String(p.id),
      name: String(p.name),
      playlistType: String(p.playlistType ?? p.playlist_type ?? "custom"),
      tracks: ((p.tracks as Record<string, unknown>[]) ?? []).map(normalizeTrack),
    }));
  },
};
