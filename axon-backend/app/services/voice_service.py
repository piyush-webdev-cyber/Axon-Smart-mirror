"""Voice command routing and AI orchestration."""

from __future__ import annotations

import re
from datetime import datetime

from app.ai.gemini import gemini_client
from app.core.logging import get_logger
from app.core.voice_config import WAKE_WORD_PATTERN
from app.services.weather_service import fetch_current_weather

logger = get_logger(__name__)


_HEY_JARVIS_PREFIX = re.compile(r"^hey[\s,]+jarvis[\s,!.:.-]*", re.IGNORECASE)


def normalize_transcript(transcript: str) -> str:
    text = transcript.strip()
    text = WAKE_WORD_PATTERN.sub("", text).strip()
    text = _HEY_JARVIS_PREFIX.sub("", text).strip()
    return text


def _contains_any(text: str, phrases: tuple[str, ...]) -> bool:
    return any(phrase in text for phrase in phrases)


def _extract_music_query(cleaned: str, lowered: str) -> str | None:
    """Pull song/artist query from natural language play commands."""
    prefixes = (
        "play the song ",
        "play song ",
        "play music ",
        "play songs by ",
        "play songs from ",
        "play ",
    )
    for prefix in prefixes:
        if lowered.startswith(prefix):
            query = cleaned[len(prefix) :].strip()
            for suffix in (" songs", " song", " music", " playlist"):
                if query.lower().endswith(suffix):
                    query = query[: -len(suffix)].strip()
            return query or None
    return None


async def process_voice_command(
    transcript: str,
    *,
    lat: float | None = None,
    lon: float | None = None,
    display_name: str | None = None,
    user_id: str | None = None,
) -> dict:
    """Route transcript to fast local handlers or Gemini."""
    cleaned = normalize_transcript(transcript)
    lowered = cleaned.lower()

    if not cleaned:
        return {
            "reply": "Yes? How can I help?",
            "action": None,
            "source": "router",
        }

    # --- Fast local commands (no LLM latency) --------------------------------

    if _contains_any(lowered, ("what time is it", "what's the time", "tell me the time", "time is it")):
        now = datetime.now()
        spoken = now.strftime("%I:%M %p").lstrip("0")
        return {
            "reply": f"It's {spoken}.",
            "action": None,
            "source": "router",
        }

    if "time" in lowered and _contains_any(
        lowered,
        ("what", "tell", "current", "now"),
    ):
        now = datetime.now()
        spoken = now.strftime("%I:%M %p").lstrip("0")
        return {
            "reply": f"It's {spoken}.",
            "action": None,
            "source": "router",
        }

    if _contains_any(lowered, ("what's the weather", "what is the weather", "how's the weather")):
        if lat is not None and lon is not None:
            try:
                weather = await fetch_current_weather(lat, lon)
                return {
                    "reply": (
                        f"It's {weather['temperature']} degrees and {weather['label'].lower()} "
                        f"in {weather['location']}."
                    ),
                    "action": None,
                    "source": "router",
                }
            except Exception as exc:
                logger.warning("Weather command failed: %s", exc)
        return {
            "reply": "I couldn't get the weather right now. Please check your location settings.",
            "action": None,
            "source": "router",
        }

    if _contains_any(lowered, ("open camera", "launch camera", "start camera")):
        return {"reply": "Opening camera.", "action": "open_camera", "source": "router"}

    if _contains_any(
        lowered,
        ("take a photo", "take photo", "capture photo", "snap a photo", "take picture"),
    ):
        return {"reply": "Taking a photo.", "action": "take_photo", "source": "router"}

    if _contains_any(
        lowered,
        ("show my photos", "download my photos", "download photos", "photos on my phone"),
    ):
        return {
            "reply": "Here's a QR code to view your photos on your phone.",
            "action": "show_gallery_qr",
            "source": "router",
        }

    if _contains_any(
        lowered,
        ("open gallery", "show gallery", "my gallery", "view gallery"),
    ):
        return {"reply": "Opening your gallery.", "action": "open_gallery", "source": "router"}

    if _contains_any(
        lowered,
        ("delete this photo", "delete photo", "remove this photo", "remove photo"),
    ):
        return {"reply": "Deleting the photo.", "action": "delete_photo", "source": "router"}

    if _contains_any(
        lowered,
        ("open interview", "interview mode", "start interview"),
    ):
        return {
            "reply": "Opening interview mode.",
            "action": "open_interview",
            "source": "router",
        }

    if _contains_any(lowered, ("go home", "take me home", "home screen")):
        return {"reply": "Going home.", "action": "go_home", "source": "router"}

    # --- Music (Phase 6) -----------------------------------------------------

    if _contains_any(lowered, ("open music", "music mode", "launch music")):
        return {"reply": "Opening music.", "action": "open_music", "source": "router"}

    if _contains_any(lowered, ("close music", "exit music", "stop music mode")):
        return {"reply": "Closing music.", "action": "close_music", "source": "router"}

    if _contains_any(lowered, ("pause music", "pause the music", "pause song")):
        return {"reply": "Pausing music.", "action": "pause_music", "source": "router"}

    if _contains_any(lowered, ("resume music", "continue music", "unpause music")):
        return {"reply": "Resuming music.", "action": "resume_music", "source": "router"}

    if _contains_any(lowered, ("stop music", "stop the music", "stop song")):
        return {"reply": "Stopping music.", "action": "stop_music", "source": "router"}

    if _contains_any(lowered, ("next song", "next track", "skip song", "skip track")):
        return {"reply": "Playing next song.", "action": "next_track", "source": "router"}

    if _contains_any(
        lowered,
        ("previous song", "previous track", "last song", "go back", "back one song"),
    ):
        return {"reply": "Playing previous song.", "action": "previous_track", "source": "router"}

    if _contains_any(lowered, ("increase volume", "volume up", "turn it up", "louder")):
        return {"reply": "Increasing volume.", "action": "volume_up", "source": "router"}

    if _contains_any(lowered, ("decrease volume", "volume down", "turn it down", "quieter")):
        return {"reply": "Decreasing volume.", "action": "volume_down", "source": "router"}

    if lowered in {"mute", "mute music", "mute the music"} or "mute music" in lowered:
        return {"reply": "Muting music.", "action": "mute_music", "source": "router"}

    if _contains_any(lowered, ("unmute", "unmute music")):
        return {"reply": "Unmuting music.", "action": "unmute_music", "source": "router"}

    if _contains_any(lowered, ("shuffle", "shuffle songs", "shuffle music")):
        return {"reply": "Shuffling songs.", "action": "shuffle_music", "source": "router"}

    if _contains_any(lowered, ("repeat song", "repeat track", "repeat music", "repeat")):
        return {"reply": "Toggling repeat.", "action": "repeat_music", "source": "router"}

    if lowered.startswith("play ") or _contains_any(
        lowered,
        ("play music", "play songs", "play some music", "start music"),
    ):
        query = _extract_music_query(cleaned, lowered)
        if query:
            return {
                "reply": f"Playing {query}.",
                "action": "play_music",
                "music_query": query,
                "source": "router",
            }
        return {
            "reply": "Playing recommended music.",
            "action": "play_music",
            "source": "router",
        }

    if _contains_any(lowered, ("who am i", "what's my name", "what is my name")):
        if display_name:
            return {
                "reply": f"You are {display_name}.",
                "action": None,
                "source": "router",
            }
        if user_id:
            return {
                "reply": f"You're signed in. Your account id ends with {user_id[-8:]}.",
                "action": None,
                "source": "router",
            }
        return {
            "reply": "You're using Axon as a guest. Link your phone to personalize your mirror.",
            "action": None,
            "source": "router",
        }

    # --- Gemini fallback -----------------------------------------------------

    if gemini_client.enabled:
        try:
            ai = await gemini_client.generate_voice_reply(cleaned, user_name=display_name)
            ai["source"] = "gemini"
            return ai
        except Exception as exc:
            logger.warning("Gemini voice fallback failed: %s", exc)

    return {
        "reply": "I'm having trouble thinking right now. Please try again in a moment.",
        "action": None,
        "source": "router",
    }
