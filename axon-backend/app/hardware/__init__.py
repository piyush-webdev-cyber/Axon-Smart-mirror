"""Hardware abstraction layer — platform adapters for desktop, Electron, and Pi."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from enum import Enum


class PlatformProfile(str, Enum):
    DESKTOP = "desktop"
    ELECTRON = "electron"
    RASPBERRY_PI = "raspberry_pi"
    ANDROID = "android"


@dataclass(frozen=True)
class MicCapabilities:
    available: bool
    sample_rate: int = 16_000
    backend: str = "unknown"


@dataclass(frozen=True)
class SpeakerCapabilities:
    available: bool
    backend: str = "unknown"


@dataclass(frozen=True)
class CameraCapabilities:
    available: bool
    backend: str = "unknown"


class MicrophoneAdapter(ABC):
    @abstractmethod
    def capabilities(self) -> MicCapabilities:
        raise NotImplementedError


class SpeakerAdapter(ABC):
    @abstractmethod
    def capabilities(self) -> SpeakerCapabilities:
        raise NotImplementedError


class CameraAdapter(ABC):
    @abstractmethod
    def capabilities(self) -> CameraCapabilities:
        raise NotImplementedError


class DisplayAdapter(ABC):
    @abstractmethod
    def profile(self) -> PlatformProfile:
        raise NotImplementedError


def detect_platform_profile() -> PlatformProfile:
    import os

    if os.environ.get("AXON_VOICE_LOCAL_MIC") == "true":
        return PlatformProfile.ELECTRON
    return PlatformProfile.DESKTOP
