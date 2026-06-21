"""Weather API schemas (normalized for the mirror UI)."""

from __future__ import annotations

from pydantic import BaseModel, Field


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

    model_config = {"populate_by_name": True}
