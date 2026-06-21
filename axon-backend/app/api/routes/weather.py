"""Weather API routes."""

from __future__ import annotations

from fastapi import APIRouter, Query

from app.schemas.weather import WeatherResponse
from app.services.weather_service import fetch_current_weather

router = APIRouter(prefix="/weather", tags=["weather"])


@router.get("/current", response_model=WeatherResponse)
async def get_current_weather(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
) -> WeatherResponse:
    """Return live weather for coordinates (mirror geolocation)."""
    data = await fetch_current_weather(lat, lon)
    return WeatherResponse.model_validate(data)
