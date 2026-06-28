"""Voice assistant configuration — single source of truth (backend).

Product branding remains Axon Smart Mirror. Only the voice assistant identity
and wake word are defined here. Keep in sync with:
``axon-frontend/src/constants/voiceConfig.ts``
"""

from __future__ import annotations

import re

VOICE_ASSISTANT_NAME = "Jarvis"
WAKE_WORD = "hey jarvis"

# Alternate wake phrases (stripped before offline intent matching).
WAKE_WORD_ALIASES = ("hey jarvis", "jarvis", "axon", "nexa")

WAKE_WORD_PATTERN = re.compile(
    r"^(?:hey[\s,]+jarvis|jarvis|axon|nexa)[,\s!:.-]*",
    re.IGNORECASE,
)

WAKE_WORD_BOUNDARY_PATTERN = re.compile(
    r"\b(?:hey[\s,]+jarvis|jarvis|axon|nexa)\b",
    re.IGNORECASE,
)
