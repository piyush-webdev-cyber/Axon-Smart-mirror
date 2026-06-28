"""Electron/desktop hardware adapters."""

from __future__ import annotations

from app.hardware import (
    CameraAdapter,
    CameraCapabilities,
    MicrophoneAdapter,
    MicCapabilities,
    PlatformProfile,
    SpeakerAdapter,
    SpeakerCapabilities,
    DisplayAdapter,
)


class LocalMicAdapter(MicrophoneAdapter):
    def capabilities(self) -> MicCapabilities:
        try:
            import sounddevice as sd  # noqa: F401

            return MicCapabilities(available=True, sample_rate=16_000, backend="sounddevice")
        except ImportError:
            return MicCapabilities(available=False, backend="sounddevice-missing")


class BrowserSpeakerAdapter(SpeakerAdapter):
    def capabilities(self) -> SpeakerCapabilities:
        return SpeakerCapabilities(available=True, backend="browser-tts")


class BrowserCameraAdapter(CameraAdapter):
    def capabilities(self) -> CameraCapabilities:
        return CameraCapabilities(available=True, backend="browser-getusermedia")


class ElectronDisplayAdapter(DisplayAdapter):
    def profile(self) -> PlatformProfile:
        return PlatformProfile.ELECTRON
