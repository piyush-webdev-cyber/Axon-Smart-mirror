/** YouTube IFrame Player — lazy-loaded, provider-swappable at UI layer. */

import { useEffect, useRef, useCallback } from "react";

declare global {
  interface Window {
    YT?: {
      Player: new (
        element: HTMLElement,
        config: Record<string, unknown>,
      ) => YTPlayer;
      PlayerState: { PLAYING: number; PAUSED: number; ENDED: number; BUFFERING: number };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface YTPlayer {
  loadVideoById: (videoId: string) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  stopVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  setVolume: (volume: number) => void;
  mute: () => void;
  unMute: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  destroy: () => void;
}

let apiPromise: Promise<void> | null = null;

function loadYouTubeApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve) => {
    const existing = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
    if (!existing) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
    }
    window.onYouTubeIframeAPIReady = () => resolve();
    if (window.YT?.Player) resolve();
  });
  return apiPromise;
}

interface YouTubePlayerProps {
  videoId: string | null;
  isPlaying: boolean;
  volume: number;
  muted: boolean;
  onProgress: (positionSec: number, durationSec: number) => void;
  onEnded: () => void;
  onReady?: () => void;
  onError?: (message: string) => void;
}

export function YouTubePlayer({
  videoId,
  isPlaying,
  volume,
  muted,
  onProgress,
  onEnded,
  onReady,
  onError,
}: YouTubePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const lastVideoRef = useRef<string | null>(null);

  const handleStateChange = useCallback(
    (event: { data: number }) => {
      const YTState = window.YT?.PlayerState;
      if (!YTState) return;
      if (event.data === YTState.ENDED) onEnded();
    },
    [onEnded],
  );

  useEffect(() => {
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    async function init() {
      await loadYouTubeApi();
      if (cancelled || !containerRef.current || !window.YT?.Player) return;

      playerRef.current = new window.YT.Player(containerRef.current, {
        height: "0",
        width: "0",
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0,
        },
        events: {
          onReady: () => onReady?.(),
          onStateChange: handleStateChange,
          onError: () => onError?.("YouTube playback failed."),
        },
      });

      intervalId = setInterval(() => {
        const player = playerRef.current;
        if (!player) return;
        try {
          onProgress(player.getCurrentTime(), player.getDuration());
        } catch {
          /* player not ready */
        }
      }, 500);
    }

    void init();

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [handleStateChange, onError, onProgress, onReady]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player || !videoId) return;

    if (lastVideoRef.current !== videoId) {
      player.loadVideoById(videoId);
      lastVideoRef.current = videoId;
    }
  }, [videoId]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player || !videoId) return;
    if (isPlaying) player.playVideo();
    else player.pauseVideo();
  }, [isPlaying, videoId]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    player.setVolume(volume);
    if (muted) player.mute();
    else player.unMute();
  }, [volume, muted]);

  return <div ref={containerRef} className="pointer-events-none absolute h-0 w-0 overflow-hidden opacity-0" aria-hidden />;
}
