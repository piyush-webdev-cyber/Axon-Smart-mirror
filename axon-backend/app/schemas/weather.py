"""Weather API schemas (normalized for the mirror UI)."""

from __future__ import annotations

from pydantic import BaseModel, Field


class ForecastDay(BaseModel):
    day: str
    high: int
    low: int
    condition: str
    label: str


class WeatherResponse(BaseModel):
    temperature: int
    unit: str = "celsius"
    condition: str
    label: str
    location: str
    feels_like: int | None = None
    humidity: int | None = None
    high: int | None = None
    low: int | None = None
    observed_at: str | None = Field(default=None, alias="observedAt")
    forecast: list[ForecastDay] | None = None

    model_config = {"populate_by_name": True}
