/** Compact music interface — YouTube playback. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ListMusic,
  Mic,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Search,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { YouTubePlayer, type YouTubePlayerHandle } from "@/features/music/YouTubePlayer";
import { useMusicSession } from "@/features/music/useMusicSession";
import { musicApi } from "@/services/musicApi";
import { useAppStore } from "@/store";
import type { MusicTrack } from "@/types/music";
import { formatDuration } from "@/types/music";
import { cn } from "@/utils/cn";
import { useVoiceController } from "@/features/voice/useVoiceController";

export default function MusicPage() {
  const music = useAppStore((s) => s.music);
  const musicError = useAppStore((s) => s.musicError);
  const setMusicState = useAppStore((s) => s.setMusicState);
  const setMusicError = useAppStore((s) => s.setMusicError);
  const showQueue = useAppStore((s) => s.showMusicQueue);
  const setShowMusicQueue = useAppStore((s) => s.setShowMusicQueue);

  const musicVoiceTick = useAppStore((s) => s.musicVoiceTick);
  const { playQuery, onProgress, onEnded } = useMusicSession();
  const playerRef = useRef<YouTubePlayerHandle>(null);
  const loadedVideoRef = useRef<string | null>(null);
  const { press: voicePress, micReady, state: voiceState } = useVoiceController();
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);

  const artwork = music.current?.thumbnailUrl ?? "";
  const progress = music.current?.durationSec
    ? Math.min(100, (music.positionSec / music.current.durationSec) * 100)
    : 0;

  const statusLabel = useMemo(() => {
    if (musicError) return "Error";
    if (music.isPlaying) return "Playing";
    if (music.current) return "Paused";
    return "Ready";
  }, [music.current, music.isPlaying, musicError]);

  const handleSearch = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      const q = search.trim();
      if (!q) return;
      setSearching(true);
      try {
        const state = await playQuery(q);
        if (state?.current?.videoId) {
          loadedVideoRef.current = state.current.videoId;
          playerRef.current?.loadAndPlay(state.current.videoId);
        }
      } finally {
        setSearching(false);
      }
    },
    [playQuery, search],
  );

  const syncPlayerToState = useCallback(
    (state: typeof music | null, options?: { forceReload?: boolean; seekStart?: boolean }) => {
      if (!state?.current?.videoId) return;
      const { videoId } = state.current;
      const sameTrack = loadedVideoRef.current === videoId;

      if (state.isPlaying) {
        loadedVideoRef.current = videoId;
        if (options?.seekStart && sameTrack) {
          playerRef.current?.seekToStart();
        } else {
          playerRef.current?.loadAndPlay(
            videoId,
            options?.forceReload ?? !sameTrack,
          );
        }
      } else {
        playerRef.current?.pauseNow();
      }
    },
    [],
  );

  useEffect(() => {
    const vid = music.current?.videoId ?? null;
    if (!vid || !music.isPlaying) return;
    if (loadedVideoRef.current === vid) return;
    syncPlayerToState(music);
  }, [music, music.current?.videoId, music.isPlaying, syncPlayerToState]);

  useEffect(() => {
    if (!musicVoiceTick) return;
    const state = useAppStore.getState().music;
    if (state.current?.videoId && state.isPlaying) {
      syncPlayerToState(state, { forceReload: true });
    }
  }, [musicVoiceTick, syncPlayerToState]);

  const runControl = useCallback(
    async (action: () => Promise<typeof music>, options?: { forceReload?: boolean; seekStart?: boolean }) => {
      try {
        const state = await action();
        setMusicState(state);
        setMusicError(null);
        syncPlayerToState(state, options);
        return state;
      } catch (err) {
        const message =
          err instanceof TypeError && err.message === "Failed to fetch"
            ? "Cannot reach music server. Restart Electron to reload the local backend."
            : err instanceof Error
              ? err.message
              : "Action failed";
        setMusicError(message);
        return null;
      }
    },
    [setMusicError, setMusicState, syncPlayerToState],
  );

  const handlePlayPause = useCallback(async () => {
    const wasPlaying = music.isPlaying;
    if (wasPlaying) playerRef.current?.pauseNow();
    else playerRef.current?.playNow();
    setMusicState({ ...music, isPlaying: !wasPlaying });
    try {
      const state = wasPlaying ? await musicApi.pause() : await musicApi.resume();
      setMusicState(state);
      setMusicError(null);
    } catch (err) {
      setMusicState({ ...music, isPlaying: wasPlaying });
      const message =
        err instanceof TypeError && err.message === "Failed to fetch"
          ? "Cannot reach music server. Restart Electron to reload the local backend."
          : err instanceof Error
            ? err.message
            : "Playback failed";
      setMusicError(message);
    }
  }, [music, setMusicError, setMusicState]);

  const handleVolumeInput = useCallback(
    (value: number) => {
      setMusicState({ ...music, volume: value, muted: value === 0 });
    },
    [music, setMusicState],
  );

  const commitVolume = useCallback(
    (value: number) => {
      void runControl(() => musicApi.volume({ volume: value, mute: value === 0 }));
    },
    [runControl],
  );

  const toggleMute = useCallback(async () => {
    const nextMuted = !music.muted;
    setMusicState({ ...music, muted: nextMuted });
    try {
      const state = await musicApi.volume({ mute: nextMuted });
      setMusicState(state);
      setMusicError(null);
    } catch (err) {
      setMusicState({ ...music, muted: !nextMuted });
      setMusicError(err instanceof Error ? err.message : "Could not change volume");
    }
  }, [music, setMusicError, setMusicState]);

  const playTrack = useCallback(
    async (track: MusicTrack) => {
      try {
        const state = await musicApi.play({ videoId: track.videoId, track });
        setMusicState(state);
        setMusicError(null);
        loadedVideoRef.current = track.videoId;
        playerRef.current?.loadAndPlay(track.videoId);
      } catch (err) {
        setMusicError(err instanceof Error ? err.message : "Could not play track");
      }
    },
    [setMusicError, setMusicState],
  );

  const handlePlayerError = useCallback(
    (msg: string) => setMusicError(msg),
    [setMusicError],
  );

  const handlePlayerReady = useCallback(() => {
    const state = useAppStore.getState().music;
    if (state.isPlaying && state.current?.videoId) {
      loadedVideoRef.current = state.current.videoId;
      playerRef.current?.loadAndPlay(state.current.videoId, true);
    }
  }, []);

  const voiceActive = voiceState === "listening" || voiceState === "processing" || voiceState === "speaking";

  return (
    <div className="relative mx-auto flex h-full w-full max-w-3xl flex-col overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 scale-110 bg-cover bg-center opacity-25 blur-2xl transition-all duration-700"
        style={{ backgroundImage: artwork ? `url(${artwork})` : undefined }}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/50 via-surface/80 to-surface/95" />

      <div className="relative z-10 flex min-h-0 flex-1 flex-col gap-3 p-2 sm:p-4">
        {/* Search row */}
        <div className="flex shrink-0 items-center gap-2">
          <form
            onSubmit={handleSearch}
            className="glass-surface flex min-w-0 flex-1 items-center gap-2 rounded-full px-3 py-2"
          >
            <Search className="h-4 w-4 shrink-0 text-primary" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search songs…"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-content-muted"
            />
            <button
              type="button"
              onClick={voicePress}
              aria-label={micReady ? "Voice search" : "Allow microphone"}
              className={cn(
                "shrink-0 rounded-full p-1.5 transition-colors",
                voiceActive ? "bg-primary/25 text-primary ring-2 ring-primary/40" : "text-content-muted hover:text-content",
              )}
            >
              <Mic className="h-4 w-4" />
            </button>
          </form>
          <button
            type="button"
            onClick={() => setShowMusicQueue(!showQueue)}
            className={cn(
              "glass-surface flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-sm transition-all",
              showQueue && "ring-2 ring-primary/50",
            )}
          >
            <ListMusic className="h-4 w-4" />
            <span className="hidden sm:inline">Queue</span>
          </button>
          <span className="glass-surface hidden shrink-0 rounded-full px-2.5 py-1.5 text-xs text-primary sm:inline">
            {statusLabel}
          </span>
        </div>

        {musicError && (
          <div className="shrink-0 rounded-xl border border-error/30 bg-error/10 px-3 py-2 text-sm text-error">
            {musicError}
          </div>
        )}

        {/* Player card */}
        <div className="glass-surface flex min-h-0 flex-1 flex-col gap-3 rounded-2xl p-3 sm:flex-row sm:items-center sm:gap-4 sm:p-4">
          <div className="mx-auto shrink-0 sm:mx-0">
            <div className="relative h-28 w-28 overflow-hidden rounded-xl ring-1 ring-white/10 sm:h-36 sm:w-36">
              {music.current?.videoId ? (
                <YouTubePlayer
                  ref={playerRef}
                  embedded
                  videoId={music.current.videoId}
                  isPlaying={music.isPlaying}
                  volume={music.volume}
                  muted={music.muted}
                  onProgress={onProgress}
                  onEnded={onEnded}
                  onError={handlePlayerError}
                  onReady={handlePlayerReady}
                />
              ) : artwork ? (
                <img src={artwork} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center bg-white/5 text-xs text-content-muted">
                  No track
                </div>
              )}
            </div>
          </div>

          <div className="flex min-w-0 flex-1 flex-col justify-center">
            <h1 className="truncate text-base font-semibold sm:text-lg">
              {music.current?.title ?? "Search or ask Axon to play music"}
            </h1>
            <p className="mb-2 truncate text-xs text-content-muted sm:text-sm">
              {music.current?.artist ?? "Try “Play Believer” or use the mic"}
            </p>

            <div className="mb-2">
              <div className="mb-1 h-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-content-muted sm:text-xs">
                <span>{formatDuration(music.positionSec)}</span>
                <span>{formatDuration(music.current?.durationSec ?? 0)}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <button
                type="button"
                onClick={() => runControl(() => musicApi.shuffle())}
                className={cn("rounded-full p-1.5 hover:bg-white/10", music.shuffle && "text-primary")}
                aria-label="Shuffle"
              >
                <Shuffle className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => void runControl(() => musicApi.previous(), { seekStart: true })}
                className="rounded-full p-1.5 hover:bg-white/10"
                aria-label="Previous"
              >
                <SkipBack className="h-5 w-5" />
              </button>
              <button
                type="button"
                onMouseDown={() => {
                  if (music.isPlaying) playerRef.current?.pauseNow();
                  else playerRef.current?.playNow();
                }}
                onClick={() => void handlePlayPause()}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/25 ring-2 ring-primary/30 transition hover:bg-primary/40"
                aria-label={music.isPlaying ? "Pause" : "Play"}
              >
                {music.isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 translate-x-0.5" />}
              </button>
              <button
                type="button"
                onClick={() => void runControl(() => musicApi.next(), { forceReload: true })}
                className="rounded-full p-1.5 hover:bg-white/10"
                aria-label="Next"
              >
                <SkipForward className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => runControl(() => musicApi.repeat())}
                className={cn("rounded-full p-1.5 hover:bg-white/10", music.repeatMode !== "off" && "text-primary")}
                aria-label="Repeat"
              >
                {music.repeatMode === "one" ? <Repeat1 className="h-4 w-4" /> : <Repeat className="h-4 w-4" />}
              </button>

              <div className="ml-0 flex items-center gap-1.5 sm:ml-2">
                <button
                  type="button"
                  onClick={() => void toggleMute()}
                  className="rounded-full p-1 hover:bg-white/10"
                >
                  {music.muted || music.volume === 0 ? (
                    <VolumeX className="h-4 w-4" />
                  ) : (
                    <Volume2 className="h-4 w-4" />
                  )}
                </button>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={music.muted ? 0 : music.volume}
                  onChange={(e) => handleVolumeInput(Number(e.target.value))}
                  onPointerUp={(e) => commitVolume(Number(e.currentTarget.value))}
                  className="h-1 w-16 cursor-pointer appearance-none rounded-full bg-white/15 accent-primary sm:w-20"
                />
              </div>
            </div>
          </div>
        </div>

        {searching && (
          <p className="shrink-0 text-center text-xs text-primary animate-pulse">Searching…</p>
        )}
      </div>

      {/* Queue drawer */}
      {showQueue && (
        <div className="absolute inset-y-0 right-0 z-20 flex w-full max-w-xs flex-col border-l border-white/10 bg-surface/95 p-3 shadow-xl backdrop-blur-md sm:max-w-sm">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-primary">Up Next</h2>
            <button
              type="button"
              onClick={() => setShowMusicQueue(false)}
              className="rounded-full p-1 hover:bg-white/10"
              aria-label="Close queue"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {music.queue.length === 0 ? (
              <p className="text-xs text-content-muted">Queue is empty</p>
            ) : (
              <ul className="space-y-1">
                {music.queue.map((track, index) => (
                  <li key={`${track.videoId}-${index}`}>
                    <button
                      type="button"
                      onClick={() => void playTrack(track)}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-white/10"
                    >
                      {track.thumbnailUrl && (
                        <img src={track.thumbnailUrl} alt="" className="h-8 w-8 shrink-0 rounded object-cover" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium">{track.title}</p>
                        <p className="truncate text-[10px] text-content-muted">{track.artist}</p>
                      </div>
                      <span className="shrink-0 text-[10px] text-content-muted">
                        {formatDuration(track.durationSec)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
