"""System information + status endpoints."""

from __future__ import annotations

from fastapi import APIRouter

from app.schemas.system import SystemInfo, SystemStatus
from app.services import system_service

router = APIRouter(prefix="/system", tags=["system"])


@router.get("/info", response_model=SystemInfo, summary="Static system info")
async def system_info() -> SystemInfo:
    return system_service.get_system_info()


@router.get("/status", response_model=SystemStatus, summary="Live system status")
async def system_status() -> SystemStatus:
    return system_service.get_system_status()
