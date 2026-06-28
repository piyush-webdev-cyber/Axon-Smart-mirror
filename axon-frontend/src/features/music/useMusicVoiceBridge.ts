/** Handle voice-triggered music playback from any route (not only MusicPage). */

import { useEffect } from "react";
import { musicApi } from "@/services/musicApi";
import { useAppStore } from "@/store";

export function useMusicVoiceBridge(): void {
  const musicVoiceTick = useAppStore((s) => s.musicVoiceTick);
  const pendingMusicQuery = useAppStore((s) => s.pendingMusicQuery);
  const setMusicState = useAppStore((s) => s.setMusicState);
  const setMusicError = useAppStore((s) => s.setMusicError);
  const clearPendingMusicQuery = useAppStore((s) => s.clearPendingMusicQuery);

  useEffect(() => {
    if (!musicVoiceTick) return;

    async function runVoiceAction() {
      try {
        const state = pendingMusicQuery
          ? await musicApi.play({ query: pendingMusicQuery })
          : await musicApi.play({});
        setMusicState(state);
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
}
