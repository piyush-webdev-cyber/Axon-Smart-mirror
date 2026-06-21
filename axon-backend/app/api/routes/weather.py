"""Weather API routes."""

from __future__ import annotations

import ipaddress

from fastapi import APIRouter, HTTPException, Query, Request

from app.core.errors import AxonError
from app.schemas.weather import WeatherResponse
from app.services.weather_service import (
    fetch_current_weather,
    fetch_weather_by_city,
    fetch_weather_for_client_ip,
)

router = APIRouter(prefix="/weather", tags=["weather"])


def _is_public_ip(value: str) -> bool:
    try:
        addr = ipaddress.ip_address(value.strip())
    except ValueError:
        return False
    return not (
        addr.is_private
        or addr.is_loopback
        or addr.is_link_local
        or addr.is_reserved
        or addr.is_multicast
    )


def _client_ip(request: Request) -> str | None:
    """Extract the mirror device's public IP from proxy headers (Railway/Vercel)."""
    candidates: list[str] = []

    for header in ("cf-connecting-ip", "true-client-ip", "x-real-ip"):
        value = request.headers.get(header)
        if value:
            candidates.append(value.strip())

    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        for part in forwarded.split(","):
            ip = part.strip()
            if ip:
                candidates.append(ip)

    if request.client and request.client.host:
        candidates.append(request.client.host.strip())

    for ip in candidates:
        if _is_public_ip(ip):
            return ip

    return None


@router.get("/current", response_model=WeatherResponse)
async def get_current_weather(
    request: Request,
    lat: float | None = Query(None, ge=-90, le=90),
    lon: float | None = Query(None, ge=-180, le=180),
    city: str | None = Query(None, min_length=1, max_length=120),
) -> WeatherResponse:
    """Return live weather for coordinates, city, or the caller's location (IP)."""
    try:
        if city:
            data = await fetch_weather_by_city(city)
        elif lat is not None and lon is not None:
            data = await fetch_current_weather(lat, lon)
        else:
            client_ip = _client_ip(request)
            if not client_ip:
                raise HTTPException(
                    status_code=400,
                    detail="Could not resolve client IP. Enable device location or pass lat/lon.",
                )
            data = await fetch_weather_for_client_ip(client_ip)
    except AxonError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc

    return WeatherResponse.model_validate(data)
