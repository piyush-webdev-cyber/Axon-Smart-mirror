/** Premium full-screen music interface — YouTube playback. */

import { useCallback, useMemo, useState } from "react";
import {
  ListMusic,
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
} from "lucide-react";
import { YouTubePlayer } from "@/features/music/YouTubePlayer";
import { useMusicSession } from "@/features/music/useMusicSession";
import { musicApi } from "@/services/musicApi";
import { useAppStore } from "@/store";
import { formatDuration } from "@/types/music";
import { cn } from "@/utils/cn";

export default function MusicPage() {
  const music = useAppStore((s) => s.music);
  const musicError = useAppStore((s) => s.musicError);
  const setMusicState = useAppStore((s) => s.setMusicState);
  const setMusicError = useAppStore((s) => s.setMusicError);
  const showQueue = useAppStore((s) => s.showMusicQueue);
  const setShowMusicQueue = useAppStore((s) => s.setShowMusicQueue);

  const { playQuery, togglePlay, onProgress, onEnded } = useMusicSession();
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);

  const artwork = music.current?.thumbnailUrl ?? "";
  const progress = music.current?.durationSec
    ? Math.min(100, (music.positionSec / music.current.durationSec) * 100)
    : 0;

  const statusLabel = useMemo(() => {
    if (musicError) return "Error";
    if (music.isPlaying) return "Now Playing";
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
        await playQuery(q);
      } finally {
        setSearching(false);
      }
    },
    [playQuery, search],
  );

  const runControl = useCallback(
    async (action: () => Promise<typeof music>) => {
      try {
        const state = await action();
        setMusicState(state);
        setMusicError(null);
      } catch (err) {
        setMusicError(err instanceof Error ? err.message : "Action failed");
      }
    },
    [setMusicError, setMusicState],
  );

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden rounded-3xl">
      {/* Ambient blurred artwork background */}
      <div
        className="pointer-events-none absolute inset-0 scale-110 bg-cover bg-center opacity-40 blur-3xl transition-all duration-700"
        style={{ backgroundImage: artwork ? `url(${artwork})` : undefined }}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-black/80 via-surface/60 to-primary/10" />
      <div className="pointer-events-none absolute -left-24 top-1/4 h-64 w-64 animate-pulse rounded-full bg-primary/20 blur-[100px]" />
      <div className="pointer-events-none absolute -right-16 bottom-1/4 h-72 w-72 animate-pulse rounded-full bg-accent/15 blur-[120px]" />

      <YouTubePlayer
        videoId={music.current?.videoId ?? null}
        isPlaying={music.isPlaying}
        volume={music.volume}
        muted={music.muted}
        onProgress={onProgress}
        onEnded={onEnded}
        onError={(msg) => setMusicError(msg)}
      />

      <div className="relative z-10 flex min-h-[calc(100vh-4rem)] flex-col p-6 lg:p-10">
        {/* Top bar */}
        <div className="mb-8 flex flex-wrap items-center gap-4">
          <form onSubmit={handleSearch} className="glass-surface flex min-w-[240px] flex-1 items-center gap-3 rounded-full px-5 py-3">
            <Search className="h-5 w-5 text-primary" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search YouTube…"
              className="w-full bg-transparent text-body outline-none placeholder:text-content-muted"
            />
          </form>
          <button
            type="button"
            onClick={() => setShowMusicQueue(!showQueue)}
            className={cn(
              "glass-surface flex items-center gap-2 rounded-full px-5 py-3 text-body transition-all",
              showQueue && "ring-2 ring-primary/50",
            )}
          >
            <ListMusic className="h-5 w-5" />
            Queue
          </button>
          <span className="glass-surface rounded-full px-4 py-2 text-caption text-primary">{statusLabel}</span>
        </div>

        {musicError && (
          <div className="mb-4 rounded-2xl border border-error/30 bg-error/10 px-4 py-3 text-body text-error">
            {musicError}
          </div>
        )}

        <div className="grid flex-1 gap-8 lg:grid-cols-[minmax(220px,320px)_1fr] lg:items-center">
          {/* Artwork */}
          <div className="mx-auto w-full max-w-xs">
            <div className="glass-surface aspect-square overflow-hidden rounded-3xl shadow-[0_0_60px_rgba(0,212,255,0.15)] ring-1 ring-white/10">
              {artwork ? (
                <img src={artwork} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-content-muted">No track</div>
              )}
            </div>
          </div>

          {/* Now playing + controls */}
          <div className="flex flex-col justify-center">
            <h1 className="mb-2 text-heading font-bold text-glow-strong line-clamp-2">
              {music.current?.title ?? "Ask Axon to play music"}
            </h1>
            <p className="mb-8 text-subheading text-text-secondary">
              {music.current?.artist ?? "Try “Play Believer” or search above"}
            </p>

            {/* Progress */}
            <div className="mb-8 max-w-xl">
              <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex justify-between text-caption text-content-muted">
                <span>{formatDuration(music.positionSec)}</span>
                <span>{formatDuration(music.current?.durationSec ?? 0)}</span>
              </div>
            </div>

            {/* Transport */}
            <div className="mb-8 flex flex-wrap items-center justify-center gap-4 lg:justify-start">
              <button
                type="button"
                onClick={() => runControl(() => musicApi.shuffle())}
                className={cn("glass-surface rounded-full p-3", music.shuffle && "text-primary ring-2 ring-primary/40")}
                aria-label="Shuffle"
              >
                <Shuffle className="h-5 w-5" />
              </button>
              <button type="button" onClick={() => runControl(() => musicApi.previous())} className="glass-surface rounded-full p-3" aria-label="Previous">
                <SkipBack className="h-6 w-6" />
              </button>
              <button
                type="button"
                onClick={() => togglePlay(music)}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/20 ring-4 ring-primary/30 transition hover:bg-primary/35"
                aria-label={music.isPlaying ? "Pause" : "Play"}
              >
                {music.isPlaying ? <Pause className="h-8 w-8" /> : <Play className="h-8 w-8 translate-x-0.5" />}
              </button>
              <button type="button" onClick={() => runControl(() => musicApi.next())} className="glass-surface rounded-full p-3" aria-label="Next">
                <SkipForward className="h-6 w-6" />
              </button>
              <button
                type="button"
                onClick={() => runControl(() => musicApi.repeat())}
                className={cn("glass-surface rounded-full p-3", music.repeatMode !== "off" && "text-primary ring-2 ring-primary/40")}
                aria-label="Repeat"
              >
                {music.repeatMode === "one" ? <Repeat1 className="h-5 w-5" /> : <Repeat className="h-5 w-5" />}
              </button>
            </div>

            {/* Volume */}
            <div className="flex max-w-md items-center gap-3">
              <button
                type="button"
                onClick={() => runControl(() => musicApi.volume({ mute: !music.muted }))}
                className="glass-surface rounded-full p-2"
              >
                {music.muted || music.volume === 0 ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </button>
              <input
                type="range"
                min={0}
                max={100}
                value={music.muted ? 0 : music.volume}
                onChange={(e) => void runControl(() => musicApi.volume({ volume: Number(e.target.value) }))}
                className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-white/15 accent-primary"
              />
              <span className="w-10 text-caption text-content-muted">{music.muted ? 0 : music.volume}%</span>
            </div>
          </div>
        </div>

        {/* Queue panel */}
        {showQueue && (
          <div className="glass-surface mt-6 max-h-64 overflow-y-auto rounded-2xl p-4">
            <h2 className="mb-3 text-body font-semibold text-primary">Up Next</h2>
            {music.queue.length === 0 ? (
              <p className="text-caption text-content-muted">Queue is empty</p>
            ) : (
              <ul className="space-y-2">
                {music.queue.map((track, index) => (
                  <li key={`${track.videoId}-${index}`} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-white/5">
                    {track.thumbnailUrl && (
                      <img src={track.thumbnailUrl} alt="" className="h-10 w-10 rounded-lg object-cover" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-body">{track.title}</p>
                      <p className="truncate text-caption text-content-muted">{track.artist}</p>
                    </div>
                    <span className="text-caption text-content-muted">{formatDuration(track.durationSec)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {searching && (
          <p className="mt-4 text-center text-caption text-primary animate-pulse">Searching YouTube…</p>
        )}
      </div>
    </div>
  );
}
