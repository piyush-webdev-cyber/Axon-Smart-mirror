"""Offline voice intent engine — Phase 6 command coverage."""

from __future__ import annotations

import pytest

from app.services.offline_intent_engine import match_offline_intent, normalize_transcript


@pytest.mark.parametrize(
    ("transcript", "action", "music_query"),
    [
        ("hey jarvis, what time is it", None, None),
        ("Axon, what's the date", None, None),
        ("take a photo", "take_photo", None),
        ("open camera", "open_camera", None),
        ("close camera", "close_camera", None),
        ("show my photos", "show_gallery_qr", None),
        ("give me my photos", "show_gallery_qr", None),
        ("open gallery", "open_gallery", None),
        ("delete latest photo", "delete_photo", None),
        ("play songs", "play_music", None),
        ("play Believer", "play_music", "Believer"),
        ("pause music", "pause_music", None),
        ("resume music", "resume_music", None),
        ("next song", "next_track", None),
        ("previous song", "previous_track", None),
        ("increase volume", "volume_up", None),
        ("decrease volume", "volume_down", None),
        ("mute", "mute_music", None),
        ("unmute", "unmute_music", None),
        ("open home", "go_home", None),
        ("open settings", "open_settings", None),
        ("open interview", "open_interview", None),
        ("open weather", "open_weather", None),
        ("refresh weather", "refresh_weather", None),
        ("logout", "logout", None),
    ],
)
def test_offline_intent_actions(
    transcript: str,
    action: str | None,
    music_query: str | None,
) -> None:
    intent = match_offline_intent(transcript)
    assert intent is not None
    assert intent.action == action
    if music_query is not None:
        assert intent.music_query == music_query


def test_offline_weather_flag() -> None:
    intent = match_offline_intent("what is the weather today")
    assert intent is not None
    assert intent.action == "__weather__"


def test_unknown_returns_none() -> None:
    assert match_offline_intent("explain quantum entanglement in detail") is None


def test_voice_service_unknown_no_gemini() -> None:
    import asyncio

    from app.services.voice_service import process_voice_command

    result = asyncio.run(process_voice_command("explain quantum entanglement"))
    assert result["source"] == "offline"
    assert result["action"] is None
    assert "didn't understand" in result["reply"].lower()


def test_wake_prefix_stripped() -> None:
    cleaned = normalize_transcript("Hey Jarvis, take a photo")
    assert cleaned.lower() == "take a photo"
