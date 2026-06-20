"""Gemini AI client wrapper (Phase 1 stub).

Defines the provider-agnostic interface that future AI features (Daily Coach,
InterviewGPT, conversational assistant) will depend on. No network calls happen
in Phase 1 - the concrete implementation lands in a later phase. Keeping the
seam here means swapping providers never touches feature code.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.core.config import settings
from app.core.errors import NotImplementedYetError
from app.core.logging import get_logger

logger = get_logger(__name__)


@dataclass
class GeminiResponse:
    text: str
    model: str


class GeminiClient:
    def __init__(self) -> None:
        self._api_key = settings.gemini_api_key
        self.enabled = bool(self._api_key)

    async def generate(
        self, prompt: str, *, model: str = "gemini-pro"
    ) -> GeminiResponse:
        """Reserved for Phase 2+. Raises until implemented."""
        raise NotImplementedYetError("AI generation")


gemini_client = GeminiClient()
