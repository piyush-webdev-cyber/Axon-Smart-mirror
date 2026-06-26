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

    if _contains_any(lowered, ("play music", "start music")):
        return {
            "reply": "Music isn't available yet, but I'll remember you asked.",
            "action": "play_music",
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
