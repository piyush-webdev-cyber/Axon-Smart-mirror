"""Music provider abstraction — swap YouTube for Spotify/Apple Music later."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class ProviderTrack:
    video_id: str
    title: str
    artist: str
    thumbnail_url: str | None
    duration_sec: int


class MusicProvider(ABC):
    @abstractmethod
    async def search(self, query: str, *, limit: int = 10) -> list[ProviderTrack]:
        raise NotImplementedError

    @abstractmethod
    async def get_track(self, video_id: str) -> ProviderTrack | None:
        raise NotImplementedError
