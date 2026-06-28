/**
 * Resolves voice transcripts offline-first — never calls Gemini for mirror controls.
 */

import { MirrorIntent, matchIntent, isKnownIntent, type IntentPayload } from "@/features/voice/intentEngine";
import { intentToVoiceAction } from "@/features/voice/intentDispatcher";
import { logVoiceIntent } from "@/features/voice/voiceLogger";
import { setVoiceIntentDebugInfo } from "@/features/voice/voiceSpeechBridge";
import { fetchCurrentWeather } from "@/services/weatherApi";
import type { VoiceProcessResult } from "@/types/voiceAssistant";

export interface ResolveVoiceOptions {
  transcript: string;
  lat?: number;
  lon?: number;
  displayName?: string;
}

export interface ResolvedVoiceCommand {
  result: VoiceProcessResult;
  intent: MirrorIntent;
  payload: IntentPayload;
}

export async function resolveVoiceCommand(
  options: ResolveVoiceOptions,
): Promise<ResolvedVoiceCommand> {
  const started = performance.now();
  const { transcript, lat, lon } = options;

  const match = matchIntent(transcript);
  logVoiceIntent(transcript, match.intent, Math.round(performance.now() - started));
  setVoiceIntentDebugInfo({
    intent: match.intent,
    confidence: match.confidence,
    matchedPhrase: match.matchedPhrase,
  });

  if (match.intent === MirrorIntent.SHOW_WEATHER && lat != null && lon != null) {
    try {
      const weather = await fetchCurrentWeather(lat, lon);
      return {
        intent: MirrorIntent.REFRESH_WEATHER,
        payload: {},
        result: {
          reply: `It's ${weather.temperature} degrees and ${weather.label.toLowerCase()} in ${weather.location}.`,
          action: intentToVoiceAction(MirrorIntent.REFRESH_WEATHER),
          source: "offline",
        },
      };
    } catch {
      return {
        intent: MirrorIntent.SHOW_WEATHER,
        payload: {},
        result: {
          reply: match.reply,
          action: intentToVoiceAction(MirrorIntent.SHOW_WEATHER),
          source: "offline",
        },
      };
    }
  }

  if (!isKnownIntent(match.intent)) {
    return {
      intent: match.intent,
      payload: match.payload,
      result: {
        reply: match.reply,
        action: null,
        source: "offline",
      },
    };
  }

  return {
    intent: match.intent,
    payload: match.payload,
    result: {
      reply: match.reply,
      action: intentToVoiceAction(match.intent),
      musicQuery: match.payload.musicQuery ?? null,
      source: "offline",
    },
  };
}
