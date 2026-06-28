/** YouTube IFrame Player — lazy-loaded, provider-swappable at UI layer. */

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { isElectronShell } from "@/utils/deviceLinkConfig";

declare global {
  interface Window {
    YT?: {
      Player: new (
        element: HTMLElement,
        config: Record<string, unknown>,
      ) => YTPlayer;
      PlayerState: { PLAYING: number; PAUSED: number; ENDED: number; BUFFERING: number; CUED: number };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface YTPlayer {
  loadVideoById: (videoId: string | { videoId: string; startSeconds?: number }) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  stopVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  setVolume: (volume: number) => void;
  mute: () => void;
  unMute: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
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
    const prior = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prior?.();
      resolve();
    };
    if (window.YT?.Player) resolve();
  });
  return apiPromise;
}

const YT_ERROR: Record<number, string> = {
  2: "Invalid video request.",
  5: "HTML5 player error.",
  100: "Video not found or private.",
  101: "Embedding disabled for this video.",
  150: "Embedding disabled for this video.",
};

export interface YouTubePlayerHandle {
  playNow: () => void;
  pauseNow: () => void;
  loadAndPlay: (videoId: string, forceReload?: boolean) => void;
  seekToStart: () => void;
}

interface YouTubePlayerProps {
  videoId: string | null;
  isPlaying: boolean;
  volume: number;
  muted: boolean;
  embedded?: boolean;
  onProgress: (positionSec: number, durationSec: number) => void;
  onEnded: () => void;
  onReady?: () => void;
  onError?: (message: string) => void;
}

export const YouTubePlayer = forwardRef<YouTubePlayerHandle, YouTubePlayerProps>(function YouTubePlayer(
  { videoId, isPlaying, volume, muted, embedded = false, onProgress, onEnded, onReady, onError },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const lastVideoRef = useRef<string | null>(null);
  const callbacksRef = useRef({ onProgress, onEnded, onError, onReady });
  const propsRef = useRef({ videoId, isPlaying, volume, muted });
  const pendingUnmuteRef = useRef(false);
  const stuckSinceRef = useRef(0);
  const [playerReady, setPlayerReady] = useState(false);

  callbacksRef.current = { onProgress, onEnded, onError, onReady };
  propsRef.current = { videoId, isPlaying, volume, muted };

  const applyVolume = (player: YTPlayer) => {
    const { volume: vol, muted: isMuted } = propsRef.current;
    player.setVolume(vol);
    if (isMuted) player.mute();
    else player.unMute();
  };

  /** Muted start bypasses browser autoplay blocks; Electron allows direct play. */
  const startPlayback = (player: YTPlayer, id: string, forceReload = false) => {
    if (!id) return;
    const electron = isElectronShell();
    if (!electron) {
      pendingUnmuteRef.current = true;
      player.mute();
    } else {
      pendingUnmuteRef.current = false;
      applyVolume(player);
    }
    if (forceReload || lastVideoRef.current !== id) {
      player.loadVideoById({ videoId: id, startSeconds: 0 });
      lastVideoRef.current = id;
      if (electron) {
        window.setTimeout(() => {
          try {
            player.playVideo();
          } catch {
            /* retry via watchdog */
          }
        }, 150);
      }
    } else {
      try {
        player.playVideo();
      } catch {
        player.loadVideoById({ videoId: id, startSeconds: 0 });
      }
    }
  };

  useImperativeHandle(ref, () => ({
    playNow: () => {
      const player = playerRef.current;
      const id = propsRef.current.videoId;
      if (!player || !id) return;
      startPlayback(player, id, false);
    },
    pauseNow: () => {
      pendingUnmuteRef.current = false;
      playerRef.current?.pauseVideo();
    },
    loadAndPlay: (id: string, forceReload = true) => {
      const player = playerRef.current;
      if (!player || !id) return;
      startPlayback(player, id, forceReload);
    },
    seekToStart: () => {
      const player = playerRef.current;
      if (!player) return;
      try {
        player.seekTo(0, true);
        if (propsRef.current.isPlaying) player.playVideo();
      } catch {
        /* player not ready */
      }
    },
  }));

  useEffect(() => {
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    async function init() {
      await loadYouTubeApi();
      if (cancelled || !containerRef.current || !window.YT?.Player) return;

      playerRef.current = new window.YT.Player(containerRef.current, {
        height: embedded ? "100%" : "200",
        width: embedded ? "100%" : "200",
        videoId: propsRef.current.videoId ?? undefined,
        playerVars: {
          autoplay: 0,
          controls: embedded ? 1 : 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          enablejsapi: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            if (cancelled) return;
            setPlayerReady(true);
            callbacksRef.current.onReady?.();

            const player = playerRef.current;
            const { videoId: id, isPlaying: playing } = propsRef.current;
            if (!player) return;

            applyVolume(player);

            if (id && playing) {
              startPlayback(player, id, true);
            }
          },
          onStateChange: (event: { data: number }) => {
            const YTState = window.YT?.PlayerState;
            const player = playerRef.current;
            if (!YTState || !player) return;

            if (event.data === YTState.PLAYING && pendingUnmuteRef.current) {
              pendingUnmuteRef.current = false;
              applyVolume(player);
            }

            if (
              (event.data === YTState.CUED || event.data === YTState.PAUSED) &&
              propsRef.current.isPlaying
            ) {
              try {
                player.playVideo();
              } catch {
                /* retry on next watchdog tick */
              }
            }

            if (event.data === YTState.PLAYING || event.data === YTState.BUFFERING) {
              stuckSinceRef.current = 0;
            }

            if (event.data === YTState.ENDED) callbacksRef.current.onEnded();
          },
          onError: (event: { data: number }) => {
            const msg = YT_ERROR[event.data] ?? "YouTube playback failed.";
            callbacksRef.current.onError?.(msg);
          },
        },
      });

      intervalId = setInterval(() => {
        const player = playerRef.current;
        if (!player) return;
        try {
          const position = player.getCurrentTime();
          const duration = player.getDuration();
          if (Number.isFinite(position)) {
            callbacksRef.current.onProgress(position, Number.isFinite(duration) ? duration : 0);
          }

          const { videoId: id, isPlaying: playing } = propsRef.current;
          const YTState = window.YT?.PlayerState;
          if (!id || !playing || !YTState) return;

          const state = player.getPlayerState();
          if (state === YTState.PLAYING || state === YTState.BUFFERING) {
            stuckSinceRef.current = 0;
            return;
          }

          const now = Date.now();
          if (!stuckSinceRef.current) stuckSinceRef.current = now;
          if (now - stuckSinceRef.current > 2500) {
            stuckSinceRef.current = now;
            startPlayback(player, id, lastVideoRef.current !== id);
          }
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
      setPlayerReady(false);
      lastVideoRef.current = null;
      pendingUnmuteRef.current = false;
    };
  }, []);

  useEffect(() => {
    const player = playerRef.current;
    if (!playerReady || !player || !videoId) return;

    if (isPlaying) {
      startPlayback(player, videoId, lastVideoRef.current !== videoId);
    } else {
      pendingUnmuteRef.current = false;
      player.pauseVideo();
    }
  }, [playerReady, videoId, isPlaying]);

  useEffect(() => {
    const player = playerRef.current;
    if (!playerReady || !player) return;
    applyVolume(player);
  }, [playerReady, volume, muted]);

  return (
    <div
      ref={containerRef}
      className={
        embedded
          ? "h-full w-full overflow-hidden rounded-xl ring-1 ring-white/10 [&>iframe]:h-full [&>iframe]:w-full"
          : "pointer-events-none absolute bottom-0 right-0 z-0 h-px w-px overflow-hidden opacity-[0.01]"
      }
      aria-hidden={!embedded}
    />
  );
});
