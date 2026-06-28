import { describe, expect, it } from "vitest";
import { MirrorIntent, matchIntent, normalizeText } from "@/features/voice/intentEngine";

describe("intentEngine", () => {
  it("normalizes punctuation and wake words", () => {
    expect(normalizeText("Hey Jarvis, take a photo!")).toBe("take a photo");
  });

  it.each([
    ["take a photo", MirrorIntent.TAKE_PHOTO],
    ["click my picture", MirrorIntent.TAKE_PHOTO],
    ["capture image", MirrorIntent.TAKE_PHOTO],
    ["show my photos", MirrorIntent.SHOW_MY_PHOTOS],
    ["give me my photos", MirrorIntent.GIVE_ME_MY_PHOTOS],
    ["open gallery", MirrorIntent.OPEN_GALLERY],
    ["play songs", MirrorIntent.PLAY_MUSIC],
    ["pause music", MirrorIntent.PAUSE_MUSIC],
    ["resume", MirrorIntent.RESUME_MUSIC],
    ["next song", MirrorIntent.NEXT_SONG],
    ["logout", MirrorIntent.LOGOUT],
    ["what time is it", MirrorIntent.SHOW_TIME],
    ["what is today's date", MirrorIntent.SHOW_DATE],
  ])('matches "%s" → %s', (input, expected) => {
    expect(matchIntent(input).intent).toBe(expected);
  });

  it("extracts song name for play believer", () => {
    const match = matchIntent("play Believer");
    expect(match.intent).toBe(MirrorIntent.PLAY_SPECIFIC_SONG);
    expect(match.payload.musicQuery).toBe("Believer");
  });

  it("returns UNKNOWN for general knowledge questions", () => {
    const match = matchIntent("what is artificial intelligence");
    expect(match.intent).toBe(MirrorIntent.UNKNOWN);
    expect(match.reply).toBe("I didn't understand that command.");
  });
});
