"""Voice command routing — offline intents only. Gemini disabled for mirror controls."""

from __future__ import annotations

from app.core.logging import get_logger
from app.core.structured_log import log_voice_intent
from app.core.voice_config import WAKE_WORD_PATTERN
from app.services.offline_intent_engine import (
    intent_to_dict,
    match_offline_intent,
    normalize_transcript,
)
from app.services.weather_service import fetch_cached_weather, fetch_current_weather

logger = get_logger(__name__)

_UNKNOWN_REPLY = "I didn't understand that command."


async def process_voice_command(
    transcript: str,
    *,
    lat: float | None = None,
    lon: float | None = None,
    display_name: str | None = None,
    user_id: str | None = None,
) -> dict:
    """Route transcript to offline intent engine. Never calls Gemini."""
    context = {
        "lat": lat,
        "lon": lon,
        "display_name": display_name,
        "user_id": user_id,
    }

    intent = match_offline_intent(
        transcript,
        wake_pattern=WAKE_WORD_PATTERN,
        context=context,
    )

    if intent is not None:
        if intent.action == "__weather__":
            return await _weather_reply(lat, lon)

        result = intent_to_dict(intent)
        log_voice_intent(
            transcript=normalize_transcript(transcript, WAKE_WORD_PATTERN),
            action=result.get("action"),
            source="offline",
        )
        return result

    cleaned = normalize_transcript(transcript, WAKE_WORD_PATTERN)
    logger.info("[VOICE][intent] unknown transcript=%r", cleaned[:80])
    log_voice_intent(transcript=cleaned, action=None, source="offline")

    return {
        "reply": _UNKNOWN_REPLY,
        "action": None,
        "source": "offline",
    }


async def _weather_reply(lat: float | None, lon: float | None) -> dict:
    if lat is not None and lon is not None:
        try:
            weather = await fetch_current_weather(lat, lon)
            return {
                "reply": (
                    f"It's {weather['temperature']} degrees and {weather['label'].lower()} "
                    f"in {weather['location']}."
                ),
                "action": "refresh_weather",
                "source": "offline",
            }
        except Exception as exc:
            logger.warning("[WEATHER] live fetch failed: %s", exc)
            cached = fetch_cached_weather(lat, lon)
            if cached:
                return {
                    "reply": (
                        f"The last reading was {cached['temperature']} degrees and "
                        f"{cached['label'].lower()} in {cached['location']}."
                    ),
                    "action": None,
                    "source": "offline",
                }

    return {
        "reply": "I couldn't get the weather right now. Open the home screen to check the widget.",
        "action": "open_weather",
        "source": "offline",
    }
