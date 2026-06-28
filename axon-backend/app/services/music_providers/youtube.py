"""YouTube search provider (Data API v3 + Invidious fallback)."""

from __future__ import annotations

import re

import httpx

from app.core.config import settings
from app.core.logging import get_logger
from app.services.music_providers.base import MusicProvider, ProviderTrack

logger = get_logger(__name__)

_INVIDIOUS_INSTANCES = (
    "https://invidious.io",
    "https://inv.nadeko.net",
)


def _parse_duration_iso8601(value: str) -> int:
    match = re.match(
        r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?",
        value or "",
    )
    if not match:
        return 0
    hours, minutes, seconds = (int(g or 0) for g in match.groups())
    return hours * 3600 + minutes * 60 + seconds


class YouTubeMusicProvider(MusicProvider):
    async def search(self, query: str, *, limit: int = 10) -> list[ProviderTrack]:
        query = query.strip()
        if not query:
            return []

        if settings.youtube_api_key:
            tracks = await self._search_data_api(query, limit=limit)
            if tracks:
                return tracks

        return await self._search_invidious(query, limit=limit)

    async def get_track(self, video_id: str) -> ProviderTrack | None:
        video_id = video_id.strip()
        if not video_id:
            return None

        if settings.youtube_api_key:
            track = await self._get_data_api(video_id)
            if track:
                return track

        results = await self._search_invidious(video_id, limit=1)
        return results[0] if results else None

    async def _search_data_api(self, query: str, *, limit: int) -> list[ProviderTrack]:
        try:
            async with httpx.AsyncClient(timeout=12.0) as client:
                search_res = await client.get(
                    "https://www.googleapis.com/youtube/v3/search",
                    params={
                        "part": "snippet",
                        "q": query,
                        "type": "video",
                        "maxResults": min(limit, 25),
                        "key": settings.youtube_api_key,
                    },
                )
                search_res.raise_for_status()
                items = search_res.json().get("items") or []
                video_ids = [
                    item["id"]["videoId"]
                    for item in items
                    if item.get("id", {}).get("videoId")
                ]
                if not video_ids:
                    return []

                details_res = await client.get(
                    "https://www.googleapis.com/youtube/v3/videos",
                    params={
                        "part": "snippet,contentDetails",
                        "id": ",".join(video_ids),
                        "key": settings.youtube_api_key,
                    },
                )
                details_res.raise_for_status()
                return self._map_data_api_items(details_res.json().get("items") or [])
        except Exception as exc:
            logger.warning("[MUSIC] YouTube Data API search failed: %s", exc)
            return []

    async def _get_data_api(self, video_id: str) -> ProviderTrack | None:
        try:
            async with httpx.AsyncClient(timeout=12.0) as client:
                res = await client.get(
                    "https://www.googleapis.com/youtube/v3/videos",
                    params={
                        "part": "snippet,contentDetails",
                        "id": video_id,
                        "key": settings.youtube_api_key,
                    },
                )
                res.raise_for_status()
                items = self._map_data_api_items(res.json().get("items") or [])
                return items[0] if items else None
        except Exception as exc:
            logger.warning("[MUSIC] YouTube Data API track lookup failed: %s", exc)
            return None

    def _map_data_api_items(self, items: list[dict]) -> list[ProviderTrack]:
        tracks: list[ProviderTrack] = []
        for item in items:
            vid = item.get("id")
            snippet = item.get("snippet") or {}
            if not vid:
                continue
            thumbs = snippet.get("thumbnails") or {}
            thumb = (
                thumbs.get("high") or thumbs.get("medium") or thumbs.get("default") or {}
            ).get("url")
            duration = _parse_duration_iso8601(
                (item.get("contentDetails") or {}).get("duration", "")
            )
            tracks.append(
                ProviderTrack(
                    video_id=str(vid),
                    title=str(snippet.get("title") or "Unknown"),
                    artist=str(snippet.get("channelTitle") or ""),
                    thumbnail_url=thumb,
                    duration_sec=duration,
                )
            )
        return tracks

    async def _search_invidious(self, query: str, *, limit: int) -> list[ProviderTrack]:
        for base in _INVIDIOUS_INSTANCES:
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    res = await client.get(
                        f"{base}/api/v1/search",
                        params={"q": query, "type": "video"},
                    )
                    res.raise_for_status()
                    payload = res.json()
                    if not isinstance(payload, list):
                        continue
                    tracks: list[ProviderTrack] = []
                    for item in payload[:limit]:
                        if not isinstance(item, dict):
                            continue
                        video_id = str(item.get("videoId") or "")
                        if not video_id:
                            continue
                        thumbs = item.get("videoThumbnails") or []
                        thumb = thumbs[0].get("url") if thumbs else None
                        tracks.append(
                            ProviderTrack(
                                video_id=video_id,
                                title=str(item.get("title") or "Unknown"),
                                artist=str(item.get("author") or ""),
                                thumbnail_url=thumb,
                                duration_sec=int(item.get("lengthSeconds") or 0),
                            )
                        )
                    if tracks:
                        return tracks
            except Exception as exc:
                logger.debug("[MUSIC] Invidious %s failed: %s", base, exc)
        return []


youtube_provider = YouTubeMusicProvider()
