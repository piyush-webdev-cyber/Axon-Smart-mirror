"""Weather API routes."""

from __future__ import annotations

from fastapi import APIRouter, Query, Request

from app.schemas.weather import WeatherResponse
from app.services.weather_service import (
    fetch_current_weather,
    fetch_weather_by_city,
    fetch_weather_for_client_ip,
)

router = APIRouter(prefix="/weather", tags=["weather"])


def _client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return None


@router.get("/current", response_model=WeatherResponse)
async def get_current_weather(
    request: Request,
    lat: float | None = Query(None, ge=-90, le=90),
    lon: float | None = Query(None, ge=-180, le=180),
    city: str | None = Query(None, min_length=1, max_length=120),
) -> WeatherResponse:
    """Return live weather for coordinates, city, or the caller's location (IP)."""
    if city:
        data = await fetch_weather_by_city(city)
    elif lat is not None and lon is not None:
        data = await fetch_current_weather(lat, lon)
    else:
        data = await fetch_weather_for_client_ip(_client_ip(request))
    return WeatherResponse.model_validate(data)
