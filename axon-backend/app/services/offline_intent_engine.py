"""Offline voice intent router — no Gemini, no network required.

All predefined mirror commands are matched locally via phrase tables.
Unknown utterances return ``None`` so ``voice_service`` may optionally call Gemini.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Callable, Literal

from app.core.logging import get_logger

logger = get_logger(__name__)

IntentSource = Literal["offline"]

# Wake-word prefixes stripped before matching (case-insensitive).
_WAKE_PREFIXES = (
    r"^hey[\s,]+jarvis[\s,!.:.-]*",
    r"^hey[\s,]+axon[\s,!.:.-]*",
    r"^jarvis[\s,!.:.-]*",
    r"^axon[\s,!.:.-]*",
    r"^nexa[\s,!.:.-]*",
)


@dataclass(frozen=True)
class OfflineIntent:
    reply: str
    action: str | None = None
    music_query: str | None = None
    source: IntentSource = "offline"
    extra: dict[str, Any] = field(default_factory=dict)


def normalize_transcript(transcript: str, wake_pattern: re.Pattern[str] | None = None) -> str:
    text = transcript.strip()
    if wake_pattern is not None:
        text = wake_pattern.sub("", text).strip()
    for prefix in _WAKE_PREFIXES:
        text = re.sub(prefix, "", text, flags=re.IGNORECASE).strip()
    return text


def _contains(text: str, phrases: tuple[str, ...]) -> bool:
    for phrase in phrases:
        if " " in phrase:
            if phrase in text:
                return True
        elif re.search(rf"\b{re.escape(phrase)}\b", text):
            return True
    return False


def _extract_music_query(cleaned: str, lowered: str) -> str | None:
    prefixes = (
        "play the song ",
        "play song ",
        "play songs ",
        "play music ",
        "play songs by ",
        "play songs from ",
        "play the ",
        "play ",
    )
    for prefix in prefixes:
        if lowered.startswith(prefix):
            query = cleaned[len(prefix) :].strip()
            for suffix in (" songs", " song", " music", " playlist"):
                if query.lower().endswith(suffix):
                    query = query[: -len(suffix)].strip()
            return query or None

    play_idx = lowered.find(" play ")
    if play_idx >= 0:
        return cleaned[play_idx + 6 :].strip() or None

    if lowered.startswith("play"):
        return cleaned[4:].lstrip(" ,:-").strip() or None

    return None


def _smart_playlist_query(lowered: str) -> str | None:
    if _contains(lowered, ("workout playlist", "workout music", "play workout")):
        return "workout playlist"
    if _contains(lowered, ("liked songs", "my favorites", "favorite songs", "favourites")):
        return "favorites playlist"
    if _contains(lowered, ("relaxing music", "relax music", "play relax")):
        return "relaxing music"
    if _contains(lowered, ("study music", "play study")):
        return "study music"
    return None


ContextFn = Callable[[dict[str, Any]], OfflineIntent | None]


def _time_reply(_ctx: dict[str, Any]) -> OfflineIntent:
    now = datetime.now()
    spoken = now.strftime("%I:%M %p").lstrip("0")
    return OfflineIntent(reply=f"It's {spoken}.")


def _date_reply(_ctx: dict[str, Any]) -> OfflineIntent:
    now = datetime.now()
    spoken = now.strftime("%A, %B %d, %Y")
    return OfflineIntent(reply=f"Today is {spoken}.")


# Ordered rules: first match wins.
_PHRASE_RULES: list[tuple[tuple[str, ...], OfflineIntent | ContextFn]] = [
    (("what time is it", "what's the time", "tell me the time", "time is it"), _time_reply),
    (
        ("what is today's date", "what's today's date", "what is the date", "what's the date", "today's date"),
        _date_reply,
    ),
    (("open camera", "launch camera", "start camera"), OfflineIntent("Opening camera.", "open_camera")),
    (("close camera", "exit camera", "leave camera"), OfflineIntent("Closing camera.", "close_camera")),
    (
        ("take a photo", "take photo", "capture photo", "capture image", "click my picture",
         "take picture", "take a picture", "snap photo", "snap a photo"),
        OfflineIntent("Taking a photo.", "take_photo"),
    ),
    (
        ("give me my photos", "download my photos", "photos on my phone"),
        OfflineIntent("Here's a QR code to view your photos on your phone.", "show_gallery_qr"),
    ),
    (
        ("show my photos", "show pictures", "open my photos"),
        OfflineIntent("Here's a QR code to view your photos on your phone.", "show_gallery_qr"),
    ),
    (("open gallery", "show gallery", "my gallery", "view gallery", "photos", "gallery"),
     OfflineIntent("Opening your gallery.", "open_gallery")),
    (
        ("delete latest photo", "delete last photo", "remove latest photo"),
        OfflineIntent("Deleting the latest photo.", "delete_photo"),
    ),
    (
        ("delete this photo", "delete photo", "remove this photo", "remove photo"),
        OfflineIntent("Deleting the photo.", "delete_photo"),
    ),
    (("open interview", "interview mode", "start interview"), OfflineIntent("Opening interview mode.", "open_interview")),
    (("open home", "go home", "take me home", "home screen"), OfflineIntent("Going home.", "go_home")),
    (("open settings", "show settings", "settings"), OfflineIntent("Opening settings.", "open_settings")),
    (("open weather", "show weather", "weather page"), OfflineIntent("Here's the weather.", "open_weather")),
    (("refresh weather", "update weather", "reload weather"), OfflineIntent("Refreshing weather.", "refresh_weather")),
    (("open music", "music mode", "launch music"), OfflineIntent("Opening music.", "open_music")),
    (("close music", "exit music", "stop music mode"), OfflineIntent("Closing music.", "close_music")),
    (("pause music", "pause the music", "pause song", "pause", "stop playing"),
     OfflineIntent("Pausing music.", "pause_music")),
    (("resume music", "continue music", "unpause music", "resume", "continue", "play again"),
     OfflineIntent("Resuming music.", "resume_music")),
    (("stop music", "stop the music", "stop song", "stop"), OfflineIntent("Stopping music.", "stop_music")),
    (("next song", "next track", "skip song", "skip track", "next", "skip"),
     OfflineIntent("Playing next song.", "next_track")),
    (
        ("previous song", "previous track", "last song", "back song", "go back", "previous"),
        OfflineIntent("Playing previous song.", "previous_track"),
    ),
    (("increase volume", "volume up", "turn it up", "louder"), OfflineIntent("Increasing volume.", "volume_up")),
    (("decrease volume", "volume down", "turn it down", "quieter"), OfflineIntent("Decreasing volume.", "volume_down")),
    (("mute music", "mute the music", "mute"), OfflineIntent("Muting music.", "mute_music")),
    (("unmute music", "unmute"), OfflineIntent("Unmuting music.", "unmute_music")),
    (("shuffle", "shuffle songs", "shuffle music"), OfflineIntent("Shuffling songs.", "shuffle_music")),
    (("repeat song", "repeat track", "repeat music"), OfflineIntent("Toggling repeat.", "repeat_music")),
    (("logout", "log out", "sign out", "signout", "log me out"), OfflineIntent("Logging out.", "logout")),
]


def match_offline_intent(
    transcript: str,
    *,
    wake_pattern: re.Pattern[str] | None = None,
    context: dict[str, Any] | None = None,
) -> OfflineIntent | None:
    """Return a local intent or ``None`` if no offline rule matched."""
    ctx = context or {}
    cleaned = normalize_transcript(transcript, wake_pattern)
    lowered = cleaned.lower()

    if not cleaned:
        return OfflineIntent(reply="Yes? How can I help?")

    # Time heuristic (what + time)
    if "time" in lowered and _contains(lowered, ("what", "tell", "current", "now")):
        return _time_reply(ctx)

    # Weather speak (needs async — handled in voice_service)
    if _contains(
        lowered,
        (
            "what's the weather",
            "what is the weather",
            "how's the weather",
            "tell me the weather",
            "weather today",
            "weather now",
        ),
    ):
        return OfflineIntent(reply="", action="__weather__")

    for phrases, result in _PHRASE_RULES:
        if not _contains(lowered, phrases):
            continue
        intent = result(ctx) if callable(result) else result
        logger.info("[VOICE][offline] intent=%s phrases=%s", intent.action, phrases[0])
        return intent

    smart = _smart_playlist_query(lowered)
    if smart:
        return OfflineIntent(f"Playing {smart}.", "play_music", music_query=smart)

    if (
        lowered.startswith("play ")
        or lowered.startswith("play")
        or lowered in {"play song", "play a song", "play music", "play some music", "play songs", "play something"}
        or " play " in lowered
        or _contains(lowered, ("play music", "play songs", "play some music", "start music", "play me"))
    ):
        query = _extract_music_query(cleaned, lowered)
        if query:
            return OfflineIntent(f"Playing {query}.", "play_music", music_query=query)
        return OfflineIntent("Playing recommended music.", "play_music")

    if _contains(lowered, ("who am i", "what's my name", "what is my name")):
        name = ctx.get("display_name")
        user_id = ctx.get("user_id")
        if name:
            return OfflineIntent(f"You are {name}.")
        if user_id:
            return OfflineIntent(f"You're signed in. Your account id ends with {str(user_id)[-8:]}.")
        return OfflineIntent("You're using Axon as a guest. Link your phone to personalize your mirror.")

    # Short music heuristic (e.g. "Believer", "lofi")
    words = cleaned.split()
    _stop = frozenset(
        {
            "hello", "hi", "thanks", "thank", "you", "yes", "no", "ok", "okay",
            "cancel", "help", "jarvis", "axon", "nexa", "explain", "describe", "tell",
        },
    )
    if (
        1 <= len(words) <= 4
        and lowered not in _stop
        and not _contains(
            lowered,
            (
                "what", "who", "when", "where", "why", "how", "time", "weather",
                "open", "delete", "camera", "gallery", "home", "pause", "stop",
                "next", "previous", "volume", "mute", "shuffle", "repeat",
                "interview", "photo", "logout", "settings", "explain", "describe",
            ),
        )
    ):
        return OfflineIntent(f"Playing {cleaned}.", "play_music", music_query=cleaned)

    return None


def intent_to_dict(intent: OfflineIntent) -> dict[str, Any]:
    out: dict[str, Any] = {
        "reply": intent.reply,
        "action": intent.action,
        "source": intent.source,
    }
    if intent.music_query:
        out["music_query"] = intent.music_query
    out.update(intent.extra)
    return out
