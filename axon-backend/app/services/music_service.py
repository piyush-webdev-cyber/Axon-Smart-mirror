"""Music queue, playback state, history, and YouTube search."""

from __future__ import annotations

import random
from copy import deepcopy
from datetime import datetime
from typing import Any, Literal

from supabase import Client

from app.core.errors import AxonError, NotFoundError
from app.core.logging import get_logger
from app.services.music_providers.base import MusicProvider, ProviderTrack
from app.services.music_providers.youtube import youtube_provider
from app.websockets.events import WsEvent
from app.websockets.manager import connection_manager

logger = get_logger(__name__)

RepeatMode = Literal["off", "one", "all"]

_SMART_PLAYLISTS: dict[str, str] = {
    "workout": "Workout",
    "relax": "Relax",
    "study": "Study",
    "favorites": "Favorites",
    "recent": "Recently Played",
}


class MusicService:
    """Per-user music sessions with Supabase persistence."""

    _sessions: dict[str, dict[str, Any]] = {}
    _search_cache: dict[str, list[ProviderTrack]] = {}

    def __init__(self, supabase_admin: Client, provider: MusicProvider | None = None):
        self.db = supabase_admin
        self.provider = provider or youtube_provider

    async def _load_session(self, user_id: str) -> dict[str, Any]:
        if user_id in self._sessions:
            return self._sessions[user_id]

        session: dict[str, Any] = {
            "current": None,
            "queue": [],
            "history": [],
            "is_playing": False,
            "volume": 70,
            "shuffle": False,
            "repeat_mode": "off",
            "position_sec": 0.0,
            "muted": False,
        }

        try:
            result = (
                self.db.table("music_user_state")
                .select("*")
                .eq("user_id", user_id)
                .maybe_single()
                .execute()
            )
            if result.data:
                row = result.data
                session["volume"] = int(row.get("volume") or 70)
                session["shuffle"] = bool(row.get("shuffle"))
                session["repeat_mode"] = row.get("repeat_mode") or "off"
                session["is_playing"] = bool(row.get("is_playing"))
                session["position_sec"] = float(row.get("position_sec") or 0)
                session["current"] = row.get("current_track")
                session["queue"] = row.get("queue") or []
        except Exception as exc:
            logger.warning("[MUSIC] load state failed user=%s: %s", user_id, exc)

        self._sessions[user_id] = session
        return session

    async def _persist(self, user_id: str) -> None:
        session = await self._load_session(user_id)
        try:
            self.db.table("music_user_state").upsert(
                {
                    "user_id": user_id,
                    "volume": session["volume"],
                    "shuffle": session["shuffle"],
                    "repeat_mode": session["repeat_mode"],
                    "is_playing": session["is_playing"],
                    "position_sec": session["position_sec"],
                    "current_track": session["current"],
                    "queue": session["queue"],
                    "updated_at": datetime.utcnow().isoformat() + "Z",
                },
                on_conflict="user_id",
            ).execute()
        except Exception as exc:
            logger.warning("[MUSIC] persist state failed user=%s: %s", user_id, exc)

    def _track_to_dict(self, track: ProviderTrack | dict) -> dict:
        if isinstance(track, dict):
            return {
                "video_id": track.get("video_id") or track.get("videoId"),
                "title": track.get("title") or "Unknown",
                "artist": track.get("artist") or "",
                "thumbnail_url": track.get("thumbnail_url") or track.get("thumbnailUrl"),
                "duration_sec": int(track.get("duration_sec") or track.get("durationSec") or 0),
            }
        return {
            "video_id": track.video_id,
            "title": track.title,
            "artist": track.artist,
            "thumbnail_url": track.thumbnail_url,
            "duration_sec": track.duration_sec,
        }

    def _push_history(self, session: dict[str, Any], track: dict | None) -> None:
        if not track:
            return
        history: list[dict] = session.setdefault("history", [])
        video_id = track.get("video_id")
        if history and history[-1].get("video_id") == video_id:
            return
        history.append(deepcopy(track))
        if len(history) > 50:
            history.pop(0)

    async def _broadcast(self, user_id: str, event: WsEvent, extra: dict | None = None) -> None:
        state = await self.get_state(user_id)
        payload = {**state, **(extra or {})}
        await connection_manager.send_to_user(user_id, event, payload)

    async def get_state(self, user_id: str) -> dict:
        session = await self._load_session(user_id)
        return {
            "current": session["current"],
            "queue": deepcopy(session["queue"]),
            "is_playing": session["is_playing"],
            "volume": session["volume"] if not session["muted"] else 0,
            "shuffle": session["shuffle"],
            "repeat_mode": session["repeat_mode"],
            "position_sec": session["position_sec"],
            "muted": session["muted"],
        }

    async def search(self, user_id: str, query: str) -> dict:
        query = query.strip()
        if not query:
            raise AxonError("Search query is required.", status_code=400)

        cache_key = query.lower()
        if cache_key in self._search_cache:
            tracks = self._search_cache[cache_key]
        else:
            tracks = await self.provider.search(query, limit=12)
            self._search_cache[cache_key] = tracks

        mapped = [self._track_to_dict(t) for t in tracks]
        await self._broadcast(user_id, WsEvent.MUSIC_SEARCH_COMPLETED, {"query": query, "tracks": mapped})
        return {"query": query, "tracks": mapped}

    async def _append_history(self, user_id: str, track: dict) -> None:
        try:
            self.db.table("music_history").insert(
                {
                    "user_id": user_id,
                    "video_id": track["video_id"],
                    "title": track["title"],
                    "artist": track.get("artist") or "",
                    "thumbnail_url": track.get("thumbnail_url"),
                    "duration_sec": track.get("duration_sec") or 0,
                    "played_at": datetime.utcnow().isoformat() + "Z",
                }
            ).execute()
        except Exception as exc:
            logger.warning("[MUSIC] history insert failed: %s", exc)

    async def play(
        self,
        user_id: str,
        *,
        query: str | None = None,
        video_id: str | None = None,
        track: dict | None = None,
        autoplay_queue: bool = True,
    ) -> dict:
        session = await self._load_session(user_id)
        selected: dict | None = None

        if track:
            selected = self._track_to_dict(track)
        elif video_id:
            provider_track = await self.provider.get_track(video_id)
            if not provider_track:
                raise NotFoundError("Song not found on YouTube.")
            selected = self._track_to_dict(provider_track)
        elif query:
            results = await self.search(user_id, query)
            tracks = results.get("tracks") or []
            if not tracks:
                raise NotFoundError(f"No results for '{query}'.")
            selected = tracks[0]
            if autoplay_queue and len(tracks) > 1:
                session["queue"] = tracks[1:]
        else:
            if session["current"]:
                session["is_playing"] = True
                await self._persist(user_id)
                await self._broadcast(user_id, WsEvent.MUSIC_STARTED)
                return await self.get_state(user_id)
            if session["queue"]:
                selected = session["queue"].pop(0)
            else:
                rec = await self.provider.search("relaxing music", limit=5)
                if not rec:
                    raise AxonError("Could not start playback.", status_code=503)
                selected = self._track_to_dict(rec[0])
                session["queue"] = [self._track_to_dict(t) for t in rec[1:]]

        if session["current"] and session["current"].get("video_id") != selected.get("video_id"):
            self._push_history(session, session["current"])

        session["current"] = selected
        session["is_playing"] = True
        session["position_sec"] = 0.0
        await self._append_history(user_id, selected)
        await self._persist(user_id)
        await self._broadcast(user_id, WsEvent.MUSIC_STARTED, {"track": selected})
        return await self.get_state(user_id)

    async def pause(self, user_id: str) -> dict:
        session = await self._load_session(user_id)
        session["is_playing"] = False
        await self._persist(user_id)
        await self._broadcast(user_id, WsEvent.MUSIC_PAUSED)
        return await self.get_state(user_id)

    async def resume(self, user_id: str) -> dict:
        session = await self._load_session(user_id)
        if not session["current"] and session["queue"]:
            return await self.play(user_id)
        session["is_playing"] = True
        await self._persist(user_id)
        await self._broadcast(user_id, WsEvent.MUSIC_RESUMED)
        return await self.get_state(user_id)

    async def stop(self, user_id: str) -> dict:
        session = await self._load_session(user_id)
        session["is_playing"] = False
        session["current"] = None
        session["position_sec"] = 0.0
        await self._persist(user_id)
        await self._broadcast(user_id, WsEvent.MUSIC_STATE)
        return await self.get_state(user_id)

    async def next_track(self, user_id: str) -> dict:
        session = await self._load_session(user_id)
        if session["repeat_mode"] == "one" and session["current"]:
            session["position_sec"] = 0.0
            session["is_playing"] = True
            await self._persist(user_id)
            await self._broadcast(user_id, WsEvent.MUSIC_STARTED)
            return await self.get_state(user_id)

        if session["shuffle"] and session["queue"]:
            idx = random.randrange(len(session["queue"]))
            nxt = session["queue"].pop(idx)
        elif session["queue"]:
            nxt = session["queue"].pop(0)
        elif session["repeat_mode"] == "all" and session["current"]:
            session["queue"] = [session["current"]]
            nxt = session["queue"].pop(0)
        else:
            session["is_playing"] = False
            await self._persist(user_id)
            await self._broadcast(user_id, WsEvent.MUSIC_FINISHED)
            return await self.get_state(user_id)

        if session["current"]:
            self._push_history(session, session["current"])

        session["current"] = nxt
        session["is_playing"] = True
        session["position_sec"] = 0.0
        await self._append_history(user_id, nxt)
        await self._persist(user_id)
        await self._broadcast(user_id, WsEvent.MUSIC_STARTED, {"track": nxt})
        return await self.get_state(user_id)

    async def previous_track(self, user_id: str) -> dict:
        session = await self._load_session(user_id)

        if session["position_sec"] > 3 and session["current"]:
            session["position_sec"] = 0.0
            session["is_playing"] = True
            await self._persist(user_id)
            await self._broadcast(user_id, WsEvent.MUSIC_STARTED)
            return await self.get_state(user_id)

        history: list[dict] = session.get("history") or []
        if history:
            if session["current"]:
                session["queue"].insert(0, session["current"])
            prev = history.pop()
            session["history"] = history
            session["current"] = prev
            session["position_sec"] = 0.0
            session["is_playing"] = True
            await self._persist(user_id)
            await self._broadcast(user_id, WsEvent.MUSIC_STARTED, {"track": prev})
            return await self.get_state(user_id)

        if session["current"]:
            session["position_sec"] = 0.0
            session["is_playing"] = True
            await self._persist(user_id)
            await self._broadcast(user_id, WsEvent.MUSIC_STARTED)
        return await self.get_state(user_id)

    async def set_volume(
        self,
        user_id: str,
        *,
        volume: int | None = None,
        delta: int | None = None,
        mute: bool | None = None,
    ) -> dict:
        session = await self._load_session(user_id)
        if mute is True:
            session["muted"] = True
        elif mute is False:
            session["muted"] = False
        if volume is not None:
            session["volume"] = max(0, min(100, volume))
            session["muted"] = False
        if delta is not None:
            session["volume"] = max(0, min(100, session["volume"] + delta))
            session["muted"] = False
        await self._persist(user_id)
        await self._broadcast(user_id, WsEvent.MUSIC_VOLUME_CHANGED)
        return await self.get_state(user_id)

    async def set_progress(self, user_id: str, position_sec: float) -> dict:
        session = await self._load_session(user_id)
        session["position_sec"] = max(0.0, position_sec)
        await self._persist(user_id)
        await self._broadcast(user_id, WsEvent.MUSIC_PROGRESS)
        return await self.get_state(user_id)

    async def toggle_shuffle(self, user_id: str) -> dict:
        session = await self._load_session(user_id)
        session["shuffle"] = not session["shuffle"]
        await self._persist(user_id)
        await self._broadcast(user_id, WsEvent.MUSIC_QUEUE_UPDATED)
        return await self.get_state(user_id)

    async def cycle_repeat(self, user_id: str) -> dict:
        session = await self._load_session(user_id)
        order: list[RepeatMode] = ["off", "all", "one"]
        current = session.get("repeat_mode") or "off"
        idx = order.index(current) if current in order else 0
        session["repeat_mode"] = order[(idx + 1) % len(order)]
        await self._persist(user_id)
        await self._broadcast(user_id, WsEvent.MUSIC_QUEUE_UPDATED)
        return await self.get_state(user_id)

    async def get_queue(self, user_id: str) -> dict:
        session = await self._load_session(user_id)
        return {"current": session["current"], "queue": session["queue"]}

    async def update_queue(self, user_id: str, queue: list[dict]) -> dict:
        session = await self._load_session(user_id)
        session["queue"] = [self._track_to_dict(t) for t in queue]
        await self._persist(user_id)
        await self._broadcast(user_id, WsEvent.MUSIC_QUEUE_UPDATED)
        return await self.get_state(user_id)

    async def clear_queue(self, user_id: str) -> dict:
        session = await self._load_session(user_id)
        session["queue"] = []
        await self._persist(user_id)
        await self._broadcast(user_id, WsEvent.MUSIC_QUEUE_UPDATED)
        return await self.get_state(user_id)

    async def get_history(self, user_id: str, *, limit: int = 50) -> dict:
        try:
            result = (
                self.db.table("music_history")
                .select("*")
                .eq("user_id", user_id)
                .order("played_at", desc=True)
                .limit(limit)
                .execute()
            )
            items = result.data or []
        except Exception as exc:
            logger.warning("[MUSIC] history fetch failed: %s", exc)
            items = []
        return {"items": items, "total": len(items)}

    async def ensure_smart_playlists(self, user_id: str) -> list[dict]:
        playlists: list[dict] = []
        try:
            existing = (
                self.db.table("music_playlists")
                .select("*")
                .eq("user_id", user_id)
                .execute()
            )
            by_type = {row["playlist_type"]: row for row in (existing.data or [])}
            for ptype, name in _SMART_PLAYLISTS.items():
                if ptype not in by_type:
                    created = (
                        self.db.table("music_playlists")
                        .insert(
                            {
                                "user_id": user_id,
                                "name": name,
                                "playlist_type": ptype,
                                "tracks": [],
                            }
                        )
                        .execute()
                    )
                    if created.data:
                        by_type[ptype] = created.data[0]
                playlists.append(by_type[ptype])
        except Exception as exc:
            logger.warning("[MUSIC] playlists init failed: %s", exc)
        return playlists

    async def get_playlists(self, user_id: str) -> list[dict]:
        await self.ensure_smart_playlists(user_id)
        try:
            result = (
                self.db.table("music_playlists")
                .select("*")
                .eq("user_id", user_id)
                .order("created_at")
                .execute()
            )
            return result.data or []
        except Exception as exc:
            logger.warning("[MUSIC] playlists fetch failed: %s", exc)
            return []

    async def on_track_finished(self, user_id: str) -> dict:
        return await self.next_track(user_id)
