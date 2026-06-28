/**
 * Offline Intent Engine — local mirror command parser.
 * No Gemini. No network required for matching.
 */

import { stripWakeWordPrefix } from "@/constants/voiceConfig";

/** Canonical offline intents for the Smart Mirror. */
export enum MirrorIntent {
  HOME = "HOME",
  OPEN_HOME = "OPEN_HOME",
  OPEN_CAMERA = "OPEN_CAMERA",
  CLOSE_CAMERA = "CLOSE_CAMERA",
  TAKE_PHOTO = "TAKE_PHOTO",
  OPEN_GALLERY = "OPEN_GALLERY",
  SHOW_MY_PHOTOS = "SHOW_MY_PHOTOS",
  GIVE_ME_MY_PHOTOS = "GIVE_ME_MY_PHOTOS",
  DELETE_LAST_PHOTO = "DELETE_LAST_PHOTO",
  OPEN_INTERVIEW = "OPEN_INTERVIEW",
  OPEN_SETTINGS = "OPEN_SETTINGS",
  PLAY_MUSIC = "PLAY_MUSIC",
  PLAY_SPECIFIC_SONG = "PLAY_SPECIFIC_SONG",
  PAUSE_MUSIC = "PAUSE_MUSIC",
  RESUME_MUSIC = "RESUME_MUSIC",
  STOP_MUSIC = "STOP_MUSIC",
  NEXT_SONG = "NEXT_SONG",
  PREVIOUS_SONG = "PREVIOUS_SONG",
  VOLUME_UP = "VOLUME_UP",
  VOLUME_DOWN = "VOLUME_DOWN",
  MUTE = "MUTE",
  UNMUTE = "UNMUTE",
  SHOW_WEATHER = "SHOW_WEATHER",
  REFRESH_WEATHER = "REFRESH_WEATHER",
  SHOW_TIME = "SHOW_TIME",
  SHOW_DATE = "SHOW_DATE",
  LOGOUT = "LOGOUT",
  UNKNOWN = "UNKNOWN",
}

export interface IntentPayload {
  musicQuery?: string;
}

export interface IntentMatch {
  intent: MirrorIntent;
  reply: string;
  payload: IntentPayload;
  confidence: number;
  matchedPhrase: string;
}

type Rule = {
  intent: MirrorIntent;
  phrases: readonly string[];
  reply: string | ((text: string) => string);
  payload?: IntentPayload | ((text: string) => IntentPayload);
};

/** Lowercase, strip punctuation, collapse whitespace. */
export function normalizeText(raw: string): string {
  return stripWakeWordPrefix(raw)
    .toLowerCase()
    .replace(/[^\w\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsPhrase(text: string, phrase: string): boolean {
  if (phrase.includes(" ")) {
    return text.includes(phrase);
  }
  const re = new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
  return re.test(text);
}

function matchesAny(text: string, phrases: readonly string[]): boolean {
  return phrases.some((p) => containsPhrase(text, p));
}

function findMatchedPhrase(text: string, phrases: readonly string[]): string {
  for (const phrase of phrases) {
    if (containsPhrase(text, phrase)) return phrase;
  }
  return "";
}

function matchConfidence(normalized: string, phrase: string): number {
  if (!phrase) return 0.5;
  if (normalized === phrase) return 0.97;
  if (normalized.includes(phrase)) return 0.92;
  return 0.85;
}

function buildMatch(
  intent: MirrorIntent,
  reply: string,
  payload: IntentPayload,
  normalized: string,
  phrases: readonly string[],
): IntentMatch {
  const matchedPhrase = findMatchedPhrase(normalized, phrases) || normalized;
  return {
    intent,
    reply,
    payload,
    confidence: matchConfidence(normalized, matchedPhrase),
    matchedPhrase,
  };
}

function formatTime(): string {
  return new Date().toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDate(): string {
  return new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function extractMusicQuery(cleaned: string, normalized: string): string | null {
  const prefixes = [
    "play the song ",
    "play song ",
    "play songs ",
    "play music ",
    "play the ",
    "play ",
  ];
  for (const prefix of prefixes) {
    if (normalized.startsWith(prefix)) {
      let query = cleaned.slice(prefix.length).trim();
      for (const suffix of [" songs", " song", " music", " playlist"]) {
        if (query.toLowerCase().endsWith(suffix)) {
          query = query.slice(0, -suffix.length).trim();
        }
      }
      return query || null;
    }
  }
  const idx = normalized.indexOf(" play ");
  if (idx >= 0) {
    return cleaned.slice(idx + 6).trim() || null;
  }
  if (normalized.startsWith("play")) {
    return cleaned.slice(4).replace(/^[\s,:-]+/, "").trim() || null;
  }
  return null;
}

const RULES: Rule[] = [
  {
    intent: MirrorIntent.SHOW_TIME,
    phrases: ["what time is it", "what's the time", "tell me the time", "current time"],
    reply: () => `It's ${formatTime()}.`,
  },
  {
    intent: MirrorIntent.SHOW_DATE,
    phrases: [
      "what is today's date",
      "what's today's date",
      "what is the date",
      "what's the date",
      "today's date",
    ],
    reply: () => `Today is ${formatDate()}.`,
  },
  {
    intent: MirrorIntent.SHOW_WEATHER,
    phrases: [
      "what's the weather",
      "what is the weather",
      "how's the weather",
      "tell me the weather",
      "weather today",
      "weather now",
    ],
    reply: "Let me check the weather for you.",
  },
  {
    intent: MirrorIntent.REFRESH_WEATHER,
    phrases: ["refresh weather", "update weather", "reload weather"],
    reply: "Refreshing weather.",
  },
  {
    intent: MirrorIntent.OPEN_CAMERA,
    phrases: ["open camera", "launch camera", "start camera"],
    reply: "Opening camera.",
  },
  {
    intent: MirrorIntent.CLOSE_CAMERA,
    phrases: ["close camera", "exit camera", "leave camera"],
    reply: "Closing camera.",
  },
  {
    intent: MirrorIntent.TAKE_PHOTO,
    phrases: [
      "take a photo",
      "take photo",
      "capture photo",
      "capture image",
      "click my picture",
      "take picture",
      "take a picture",
      "snap photo",
      "snap a photo",
    ],
    reply: "Taking a photo.",
  },
  {
    intent: MirrorIntent.GIVE_ME_MY_PHOTOS,
    phrases: ["give me my photos", "download my photos", "photos on my phone"],
    reply: "Here's a QR code to view your photos on your phone.",
  },
  {
    intent: MirrorIntent.SHOW_MY_PHOTOS,
    phrases: ["show my photos", "show pictures", "open my photos"],
    reply: "Here's a QR code to view your photos on your phone.",
  },
  {
    intent: MirrorIntent.OPEN_GALLERY,
    phrases: ["open gallery", "show gallery", "my gallery", "view gallery", "photos", "gallery"],
    reply: "Opening your gallery.",
  },
  {
    intent: MirrorIntent.DELETE_LAST_PHOTO,
    phrases: [
      "delete latest photo",
      "delete last photo",
      "remove latest photo",
      "delete photo",
      "remove photo",
    ],
    reply: "Deleting the latest photo.",
  },
  {
    intent: MirrorIntent.OPEN_INTERVIEW,
    phrases: ["open interview", "interview mode", "start interview"],
    reply: "Opening interview mode.",
  },
  {
    intent: MirrorIntent.OPEN_HOME,
    phrases: ["open home", "go home", "take me home", "home screen", "home"],
    reply: "Going home.",
  },
  {
    intent: MirrorIntent.OPEN_SETTINGS,
    phrases: ["open settings", "show settings", "settings"],
    reply: "Opening settings.",
  },
  {
    intent: MirrorIntent.SHOW_WEATHER,
    phrases: ["open weather", "show weather page"],
    reply: "Here's the weather.",
  },
  {
    intent: MirrorIntent.PAUSE_MUSIC,
    phrases: ["pause music", "pause the music", "pause song", "pause", "stop playing"],
    reply: "Pausing music.",
  },
  {
    intent: MirrorIntent.RESUME_MUSIC,
    phrases: ["resume music", "continue music", "unpause music", "resume", "continue", "play again"],
    reply: "Resuming music.",
  },
  {
    intent: MirrorIntent.STOP_MUSIC,
    phrases: ["stop music", "stop the music", "stop song", "stop"],
    reply: "Stopping music.",
  },
  {
    intent: MirrorIntent.NEXT_SONG,
    phrases: ["next song", "next track", "skip song", "skip track", "next", "skip"],
    reply: "Playing next song.",
  },
  {
    intent: MirrorIntent.PREVIOUS_SONG,
    phrases: ["previous song", "previous track", "last song", "back song", "previous", "go back"],
    reply: "Playing previous song.",
  },
  {
    intent: MirrorIntent.VOLUME_UP,
    phrases: ["increase volume", "volume up", "turn it up", "louder"],
    reply: "Increasing volume.",
  },
  {
    intent: MirrorIntent.VOLUME_DOWN,
    phrases: ["decrease volume", "volume down", "turn it down", "quieter"],
    reply: "Decreasing volume.",
  },
  {
    intent: MirrorIntent.MUTE,
    phrases: ["mute music", "mute the music", "mute"],
    reply: "Muting music.",
  },
  {
    intent: MirrorIntent.UNMUTE,
    phrases: ["unmute music", "unmute"],
    reply: "Unmuting music.",
  },
  {
    intent: MirrorIntent.LOGOUT,
    phrases: ["logout", "log out", "sign out", "signout", "log me out"],
    reply: "Logging out.",
  },
];

const GENERIC_PLAY_QUERIES = new Set([
  "songs",
  "song",
  "music",
  "something",
  "a song",
  "some music",
  "recommended music",
]);

const PLAY_GENERIC = [
  "play songs",
  "play music",
  "play a song",
  "play some music",
  "start music",
  "play something",
];

function isGenericPlayQuery(query: string | null): boolean {
  if (!query) return true;
  return GENERIC_PLAY_QUERIES.has(query.toLowerCase().trim());
}

/**
 * Match transcript to a structured offline intent.
 * Returns UNKNOWN when no rule matches (never calls Gemini).
 */
export function matchIntent(transcript: string): IntentMatch {
  const cleaned = stripWakeWordPrefix(transcript).trim();
  const normalized = normalizeText(transcript);

  if (!normalized) {
    return {
      intent: MirrorIntent.UNKNOWN,
      reply: "Yes? How can I help?",
      payload: {},
      confidence: 0,
      matchedPhrase: "",
    };
  }

  if (normalized.includes("time") && matchesAny(normalized, ["what", "tell", "current", "now"])) {
    return buildMatch(
      MirrorIntent.SHOW_TIME,
      `It's ${formatTime()}.`,
      {},
      normalized,
      ["what time", "current time", "tell me the time"],
    );
  }

  for (const rule of RULES) {
    if (!matchesAny(normalized, rule.phrases)) continue;
    const reply = typeof rule.reply === "function" ? rule.reply(cleaned) : rule.reply;
    const payload =
      typeof rule.payload === "function"
        ? rule.payload(cleaned)
        : rule.payload ?? {};
    return buildMatch(rule.intent, reply, payload, normalized, rule.phrases);
  }

  if (matchesAny(normalized, PLAY_GENERIC) || normalized.startsWith("play ")) {
    const query = extractMusicQuery(cleaned, normalized);
    if (query && !isGenericPlayQuery(query)) {
      return buildMatch(
        MirrorIntent.PLAY_SPECIFIC_SONG,
        `Playing ${query}.`,
        { musicQuery: query },
        normalized,
        ["play"],
      );
    }
    return buildMatch(
      MirrorIntent.PLAY_MUSIC,
      "Playing recommended music.",
      {},
      normalized,
      PLAY_GENERIC,
    );
  }

  const words = normalized.split(" ");
  const stop = new Set([
    "hello", "hi", "thanks", "thank", "you", "yes", "no", "ok", "okay",
    "cancel", "help", "jarvis", "axon", "nexa", "explain", "describe", "tell",
    "what", "who", "when", "where", "why", "how",
  ]);
  if (
    words.length >= 1 &&
    words.length <= 4 &&
    !stop.has(normalized) &&
    !normalized.startsWith("what ") &&
    !normalized.startsWith("who ") &&
    !normalized.startsWith("why ") &&
    !normalized.startsWith("how ") &&
    !matchesAny(normalized, [
      "open", "delete", "camera", "gallery", "home", "pause", "stop",
      "next", "previous", "volume", "mute", "shuffle", "repeat",
      "interview", "photo", "logout", "settings", "weather", "time",
    ])
  ) {
    return buildMatch(
      MirrorIntent.PLAY_SPECIFIC_SONG,
      `Playing ${cleaned}.`,
      { musicQuery: cleaned },
      normalized,
      ["play"],
    );
  }

  return {
    intent: MirrorIntent.UNKNOWN,
    reply: "I didn't understand that command.",
    payload: {},
    confidence: 0.3,
    matchedPhrase: normalized,
  };
}

export function isKnownIntent(intent: MirrorIntent): boolean {
  return intent !== MirrorIntent.UNKNOWN;
}
