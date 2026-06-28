/** Voice assistant REST client. */

import type { VoiceProcessResult } from "@/types/voiceAssistant";
import { env } from "@/utils/env";
import { getAccessToken } from "@/services/supabaseClient";

const API_BASE = env.apiBaseUrl;

export interface VoiceProcessOptions {
  transcript: string;
  lat?: number;
  lon?: number;
  displayName?: string;
}

export async function processVoiceTranscript(
  options: VoiceProcessOptions,
): Promise<VoiceProcessResult> {
  const token = await getAccessToken();

  const response = await fetch(`${API_BASE}/voice/process`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      transcript: options.transcript,
      lat: options.lat,
      lon: options.lon,
      display_name: options.displayName,
    }),
  });

  if (!response.ok) {
    throw new Error("Voice processing failed.");
  }

  const data = (await response.json()) as VoiceProcessResult & { music_query?: string | null };
  return {
    reply: data.reply,
    action: data.action ?? null,
    musicQuery: data.musicQuery ?? data.music_query ?? null,
    ...(data.source ? { source: data.source } : {}),
  };
}
