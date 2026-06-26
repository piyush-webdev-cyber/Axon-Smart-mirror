"""Gemini AI client wrapper.

Provider-agnostic seam for Daily Coach, InterviewGPT, and the voice assistant.
Uses the Gemini REST API via httpx (no extra SDK dependency).
"""

from __future__ import annotations

import json
from dataclasses import dataclass

import httpx

from app.core.config import settings
from app.core.errors import AxonError
from app.core.logging import get_logger

logger = get_logger(__name__)

def _gemini_url(model: str) -> str:
    return (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model}:generateContent"
    )


@dataclass
class GeminiResponse:
    text: str
    model: str


class GeminiClient:
    def __init__(self) -> None:
        self._api_key = settings.gemini_api_key
        self._default_model = settings.gemini_model or "gemini-2.0-flash"
        self.enabled = bool(self._api_key)

    async def generate(
        self,
        prompt: str,
        *,
        model: str | None = None,
        system: str | None = None,
        json_mode: bool = False,
    ) -> GeminiResponse:
        model = model or self._default_model
        if not self.enabled:
            raise AxonError("Gemini API is not configured.", status_code=503)

        parts: list[dict] = []
        if system:
            parts.append({"text": system})
        parts.append({"text": prompt})

        body: dict = {
            "contents": [{"role": "user", "parts": parts}],
        }
        if json_mode:
            body["generationConfig"] = {"responseMimeType": "application/json"}

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    _gemini_url(model),
                    params={"key": self._api_key},
                    json=body,
                )
        except httpx.HTTPError as exc:
            logger.warning("Gemini request failed: %s", exc)
            raise AxonError("AI service is unavailable.", status_code=502) from exc

        if response.status_code != 200:
            logger.warning("Gemini error %s: %s", response.status_code, response.text)
            raise AxonError("AI generation failed.", status_code=502)

        payload = response.json()
        candidates = payload.get("candidates") or []
        if not candidates:
            raise AxonError("AI returned an empty response.", status_code=502)

        content = candidates[0].get("content") or {}
        text_parts = content.get("parts") or []
        text = "".join(part.get("text", "") for part in text_parts).strip()
        if not text:
            raise AxonError("AI returned an empty response.", status_code=502)

        return GeminiResponse(text=text, model=model)

    async def generate_voice_reply(self, transcript: str, *, user_name: str | None) -> dict:
        """Return structured voice output: { reply, action }."""
        system = (
            "You are Nexa, the voice assistant for the Axon Smart Mirror. "
            "Respond in JSON only with keys: reply (short spoken answer, 1-3 sentences), "
            "action (one of: open_camera, open_gallery, open_interview, play_music, go_home, "
            "take_photo, show_gallery_qr, delete_photo, "
            "or null if no navigation is needed). "
            "Keep replies conversational and brief for text-to-speech."
        )
        name_hint = f" The user's name is {user_name}." if user_name else ""
        prompt = (
            f'{name_hint} User said: "{transcript}"\n'
            "If they ask to open a feature, set action accordingly."
        )

        result = await self.generate(prompt, system=system, json_mode=True)
        try:
            parsed = json.loads(result.text)
            reply = str(parsed.get("reply") or "").strip()
            action = parsed.get("action")
            if action == "null" or action == "":
                action = None
            if not reply:
                reply = "I'm not sure how to help with that yet."
            return {"reply": reply, "action": action}
        except json.JSONDecodeError:
            return {"reply": result.text[:500], "action": None}


gemini_client = GeminiClient()
