"""Music playback API routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.api.deps import PhotoUser, get_music_service
from app.schemas.music import (
    MusicHistoryResponse,
    MusicPlayRequest,
    MusicPlaylistsResponse,
    MusicQueueUpdateRequest,
    MusicSearchResult,
    MusicSeekRequest,
    MusicStateResponse,
    MusicVolumeRequest,
)
from app.services.music_service import MusicService

router = APIRouter(prefix="/music", tags=["music"])


@router.get("/search", response_model=MusicSearchResult)
async def search_music(
    user: PhotoUser,
    q: str = Query(..., min_length=1),
    music_service: MusicService = Depends(get_music_service),
):
    result = await music_service.search(user.id, q)
    return MusicSearchResult(**result)


@router.post("/play", response_model=MusicStateResponse)
async def play_music(
    body: MusicPlayRequest,
    user: PhotoUser,
    music_service: MusicService = Depends(get_music_service),
):
    state = await music_service.play(
        user.id,
        query=body.query,
        video_id=body.video_id,
        track=body.track.model_dump(by_alias=True) if body.track else None,
        autoplay_queue=body.autoplay_queue,
    )
    return MusicStateResponse(**state)


@router.post("/pause", response_model=MusicStateResponse)
async def pause_music(
    user: PhotoUser,
    music_service: MusicService = Depends(get_music_service),
):
    return MusicStateResponse(**await music_service.pause(user.id))


@router.post("/resume", response_model=MusicStateResponse)
async def resume_music(
    user: PhotoUser,
    music_service: MusicService = Depends(get_music_service),
):
    return MusicStateResponse(**await music_service.resume(user.id))


@router.post("/stop", response_model=MusicStateResponse)
async def stop_music(
    user: PhotoUser,
    music_service: MusicService = Depends(get_music_service),
):
    return MusicStateResponse(**await music_service.stop(user.id))


@router.post("/next", response_model=MusicStateResponse)
async def next_track(
    user: PhotoUser,
    music_service: MusicService = Depends(get_music_service),
):
    return MusicStateResponse(**await music_service.next_track(user.id))


@router.post("/previous", response_model=MusicStateResponse)
async def previous_track(
    user: PhotoUser,
    music_service: MusicService = Depends(get_music_service),
):
    return MusicStateResponse(**await music_service.previous_track(user.id))


@router.post("/volume", response_model=MusicStateResponse)
async def set_volume(
    body: MusicVolumeRequest,
    user: PhotoUser,
    music_service: MusicService = Depends(get_music_service),
):
    return MusicStateResponse(
        **await music_service.set_volume(
            user.id,
            volume=body.volume,
            delta=body.delta,
            mute=body.mute,
        )
    )


@router.post("/seek", response_model=MusicStateResponse)
async def seek_music(
    body: MusicSeekRequest,
    user: PhotoUser,
    music_service: MusicService = Depends(get_music_service),
):
    return MusicStateResponse(**await music_service.set_progress(user.id, body.position_sec))


@router.post("/shuffle", response_model=MusicStateResponse)
async def toggle_shuffle(
    user: PhotoUser,
    music_service: MusicService = Depends(get_music_service),
):
    return MusicStateResponse(**await music_service.toggle_shuffle(user.id))


@router.post("/repeat", response_model=MusicStateResponse)
async def cycle_repeat(
    user: PhotoUser,
    music_service: MusicService = Depends(get_music_service),
):
    return MusicStateResponse(**await music_service.cycle_repeat(user.id))


@router.post("/finished", response_model=MusicStateResponse)
async def track_finished(
    user: PhotoUser,
    music_service: MusicService = Depends(get_music_service),
):
    return MusicStateResponse(**await music_service.on_track_finished(user.id))


@router.get("/state", response_model=MusicStateResponse)
async def get_music_state(
    user: PhotoUser,
    music_service: MusicService = Depends(get_music_service),
):
    return MusicStateResponse(**await music_service.get_state(user.id))


@router.get("/queue", response_model=MusicStateResponse)
async def get_queue(
    user: PhotoUser,
    music_service: MusicService = Depends(get_music_service),
):
    session = await music_service.get_queue(user.id)
    state = await music_service.get_state(user.id)
    state["queue"] = session["queue"]
    state["current"] = session["current"] or state["current"]
    return MusicStateResponse(**state)


@router.put("/queue", response_model=MusicStateResponse)
async def update_queue(
    body: MusicQueueUpdateRequest,
    user: PhotoUser,
    music_service: MusicService = Depends(get_music_service),
):
    tracks = [t.model_dump() for t in body.queue]
    return MusicStateResponse(**await music_service.update_queue(user.id, tracks))


@router.delete("/queue", response_model=MusicStateResponse)
async def clear_queue(
    user: PhotoUser,
    music_service: MusicService = Depends(get_music_service),
):
    return MusicStateResponse(**await music_service.clear_queue(user.id))


@router.get("/history", response_model=MusicHistoryResponse)
async def get_history(
    user: PhotoUser,
    music_service: MusicService = Depends(get_music_service),
):
    result = await music_service.get_history(user.id)
    return MusicHistoryResponse(**result)


@router.get("/playlists", response_model=MusicPlaylistsResponse)
async def get_playlists(
    user: PhotoUser,
    music_service: MusicService = Depends(get_music_service),
):
    playlists = await music_service.get_playlists(user.id)
    return MusicPlaylistsResponse(playlists=playlists)
