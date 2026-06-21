"""Voice assistant configuration — single source of truth (backend).

Product branding remains Axon Smart Mirror. Only the voice assistant identity
and wake word are defined here. Keep in sync with:
``axon-frontend/src/constants/voiceConfig.ts``
"""

from __future__ import annotations

import re

VOICE_ASSISTANT_NAME = "Nexa"
WAKE_WORD = VOICE_ASSISTANT_NAME

WAKE_WORD_PATTERN = re.compile(
    rf"^{re.escape(WAKE_WORD)}[,\s!:.-]*",
    re.IGNORECASE,
)

WAKE_WORD_BOUNDARY_PATTERN = re.compile(
    rf"\b{re.escape(WAKE_WORD)}\b",
    re.IGNORECASE,
)
