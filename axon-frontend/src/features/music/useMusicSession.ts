/** Sync music state with backend + WebSocket + voice commands. */

import { useCallback, useEffect, useRef } from "react";
import { WS_EVENTS } from "@/constants/wsEvents";
import { musicApi } from "@/services/musicApi";
import { websocketClient } from "@/services/websocketClient";
import { useAppStore } from "@/store";
import type { MusicState } from "@/types/music";
import { normalizeMusicState } from "@/types/music";

const MUSIC_EVENTS = [
  WS_EVENTS.musicStarted,
  WS_EVENTS.musicPaused,
  WS_EVENTS.musicResumed,
  WS_EVENTS.musicProgress,
  WS_EVENTS.musicFinished,
  WS_EVENTS.musicQueueUpdated,
  WS_EVENTS.musicVolumeChanged,
  WS_EVENTS.musicSearchCompleted,
  WS_EVENTS.musicState,
] as const;

export function useMusicSession() {
  const setMusicState = useAppStore((s) => s.setMusicState);
  const setMusicError = useAppStore((s) => s.setMusicError);
  const musicVoiceTick = useAppStore((s) => s.musicVoiceTick);
  const pendingMusicQuery = useAppStore((s) => s.pendingMusicQuery);
  const clearPendingMusicQuery = useAppStore((s) => s.clearPendingMusicQuery);

  const localProgressRef = useRef(0);
  const durationRef = useRef(0);

  const applyState = useCallback(
    (raw: Record<string, unknown>) => {
      const state = normalizeMusicState(raw);
      setMusicState(state);
      return state;
    },
    [setMusicState],
  );

  const refresh = useCallback(async () => {
    try {
      const state = await musicApi.getState();
      setMusicState(state);
      setMusicError(null);
    } catch (err) {
      setMusicError(err instanceof Error ? err.message : "Failed to load music");
    }
  }, [setMusicError, setMusicState]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const unsubs = MUSIC_EVENTS.map((event) =>
      websocketClient.subscribe(event, (message) => {
        const payload = (message.payload ?? {}) as Record<string, unknown>;
        applyState(payload);
      }),
    );
    return () => unsubs.forEach((u) => u());
  }, [applyState]);

  useEffect(() => {
    if (!musicVoiceTick) return;

    async function runVoiceAction() {
      try {
        if (pendingMusicQuery) {
          const state = await musicApi.play({ query: pendingMusicQuery });
          setMusicState(state);
        } else {
          const state = await musicApi.play({});
          setMusicState(state);
        }
        setMusicError(null);
      } catch (err) {
        setMusicError(err instanceof Error ? err.message : "Could not play music");
      } finally {
        clearPendingMusicQuery();
      }
    }

    void runVoiceAction();
  }, [
    musicVoiceTick,
    pendingMusicQuery,
    clearPendingMusicQuery,
    setMusicError,
    setMusicState,
  ]);

  const playQuery = useCallback(
    async (query: string) => {
      try {
        const state = await musicApi.play({ query });
        setMusicState(state);
        setMusicError(null);
      } catch (err) {
        setMusicError(err instanceof Error ? err.message : "Song not found");
      }
    },
    [setMusicError, setMusicState],
  );

  const togglePlay = useCallback(async (current: MusicState) => {
    try {
      const state = current.isPlaying ? await musicApi.pause() : await musicApi.resume();
      setMusicState(state);
    } catch (err) {
      setMusicError(err instanceof Error ? err.message : "Playback failed");
    }
  }, [setMusicError, setMusicState]);

  const onProgress = useCallback(
    (positionSec: number, durationSec: number) => {
      localProgressRef.current = positionSec;
      durationRef.current = durationSec;
      setMusicState({
        ...useAppStore.getState().music,
        positionSec,
        current: useAppStore.getState().music.current
          ? {
              ...useAppStore.getState().music.current!,
              durationSec: durationSec || useAppStore.getState().music.current!.durationSec,
            }
          : null,
      });
    },
    [setMusicState],
  );

  const onEnded = useCallback(async () => {
    try {
      const state = await musicApi.finished();
      setMusicState(state);
    } catch {
      /* ignore */
    }
  }, [setMusicState]);

  return {
    refresh,
    playQuery,
    togglePlay,
    onProgress,
    onEnded,
    localProgressRef,
  };
}
