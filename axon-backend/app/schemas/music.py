"""Music API schemas."""

from __future__ import annotations

from typing import Literal

from pydantic import Field

from app.schemas.common import CamelModel

RepeatMode = Literal["off", "one", "all"]
PlaylistType = Literal["favorites", "recent", "workout", "relax", "study", "custom"]


class MusicTrack(CamelModel):
    video_id: str
    title: str
    artist: str = ""
    thumbnail_url: str | None = None
    duration_sec: int = 0


class MusicSearchResult(CamelModel):
    tracks: list[MusicTrack]
    query: str


class MusicPlayRequest(CamelModel):
    query: str | None = None
    video_id: str | None = None
    track: MusicTrack | None = None
    autoplay_queue: bool = True


class MusicVolumeRequest(CamelModel):
    volume: int | None = Field(default=None, ge=0, le=100)
    delta: int | None = None
    mute: bool | None = None


class MusicSeekRequest(CamelModel):
    position_sec: float = Field(..., ge=0)


class MusicQueueUpdateRequest(CamelModel):
    queue: list[MusicTrack]


class MusicStateResponse(CamelModel):
    current: MusicTrack | None = None
    queue: list[MusicTrack] = Field(default_factory=list)
    is_playing: bool = False
    volume: int = 70
    shuffle: bool = False
    repeat_mode: RepeatMode = "off"
    position_sec: float = 0
    muted: bool = False


class MusicHistoryEntry(CamelModel):
    id: str
    video_id: str
    title: str
    artist: str = ""
    thumbnail_url: str | None = None
    duration_sec: int = 0
    played_at: str


class MusicHistoryResponse(CamelModel):
    items: list[MusicHistoryEntry]
    total: int


class MusicPlaylist(CamelModel):
    id: str
    name: str
    playlist_type: PlaylistType
    tracks: list[MusicTrack] = Field(default_factory=list)


class MusicPlaylistsResponse(CamelModel):
    playlists: list[MusicPlaylist]
