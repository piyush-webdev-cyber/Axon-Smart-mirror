"""OpenWeatherMap integration."""

from __future__ import annotations

from datetime import UTC, datetime

import httpx

from app.core.config import settings
from app.core.errors import AxonError
from app.core.logging import get_logger

logger = get_logger(__name__)

OPENWEATHER_URL = "https://api.openweathermap.org/data/2.5/weather"
OPENWEATHER_FORECAST_URL = "https://api.openweathermap.org/data/2.5/forecast"
IP_API_URL = "http://ip-api.com/json"
IPWHO_URL = "https://ipwho.is"


def _map_condition(code: int) -> tuple[str, str]:
    """Map OpenWeather condition codes to UI buckets."""
    if code >= 200 and code < 300:
        return "thunderstorm", "Thunderstorm"
    if code >= 300 and code < 400:
        return "drizzle", "Drizzle"
    if code >= 500 and code < 600:
        return "rain", "Rain"
    if code >= 600 and code < 700:
        return "snow", "Snow"
    if code >= 700 and code < 800:
        return "fog", "Fog"
    if code == 800:
        return "sunny", "Clear"
    if code == 801:
        return "partly-cloudy", "Partly Cloudy"
    if code > 801:
        return "cloudy", "Cloudy"
    return "unknown", "Unknown"


async def fetch_current_weather(lat: float, lon: float) -> dict:
    """Fetch and normalize current weather for the given coordinates."""
    if not settings.openweather_api_key:
        raise AxonError("Weather API is not configured.", status_code=503)

    params = {
        "lat": lat,
        "lon": lon,
        "appid": settings.openweather_api_key,
        "units": "metric",
    }

    return await _request_openweather(params)


async def fetch_forecast(lat: float, lon: float) -> list[dict]:
    """Next 3 calendar days (daily high/low) from OpenWeather 5-day forecast."""
    if not settings.openweather_api_key:
        return []

    params = {
        "lat": lat,
        "lon": lon,
        "appid": settings.openweather_api_key,
        "units": "metric",
    }
    logger.info("[WEATHER] API Request forecast lat=%s lon=%s", lat, lon)
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(OPENWEATHER_FORECAST_URL, params=params)
    except httpx.HTTPError as exc:
        logger.warning("[WEATHER] Error: forecast %s", exc)
        raise AxonError("Unable to reach forecast service.", status_code=502) from exc

    if response.status_code != 200:
        logger.warning("[WEATHER] Error HTTP %s forecast", response.status_code)
        return []

    payload = response.json()
    entries = payload.get("list") or []
    by_day: dict[str, dict] = {}

    for entry in entries:
        dt_txt = str(entry.get("dt_txt", ""))
        if len(dt_txt) < 10:
            continue
        day_key = dt_txt[:10]
        main = entry.get("main") or {}
        temp_max = float(main.get("temp_max", main.get("temp", 0)))
        temp_min = float(main.get("temp_min", main.get("temp", 0)))
        weather_entry = (entry.get("weather") or [{}])[0]
        code = int(weather_entry.get("id", 0))
        condition, default_label = _map_condition(code)
        label = str(weather_entry.get("main") or default_label).replace("_", " ").title()

        bucket = by_day.setdefault(
            day_key,
            {"high": temp_max, "low": temp_min, "condition": condition, "label": label},
        )
        bucket["high"] = max(bucket["high"], temp_max)
        bucket["low"] = min(bucket["low"], temp_min)
        if dt_txt.endswith("12:00:00"):
            bucket["condition"] = condition
            bucket["label"] = label

    today = datetime.now(UTC).strftime("%Y-%m-%d")
    days: list[dict] = []
    for day_key in sorted(by_day.keys()):
        if day_key <= today:
            continue
        row = by_day[day_key]
        days.append(
            {
                "day": day_key,
                "high": round(row["high"]),
                "low": round(row["low"]),
                "condition": row["condition"],
                "label": row["label"],
            },
        )
        if len(days) >= 3:
            break

    logger.info("[WEATHER] API Response forecast_days=%d", len(days))
    return days


async def fetch_coords_from_client_ip(client_ip: str | None) -> tuple[float, float]:
    """Resolve approximate lat/lon from the mirror's public IP (city-level)."""
    ip = (client_ip or "").strip()
    if not ip:
        raise AxonError("Client IP is required for location lookup.", status_code=400)

    errors: list[str] = []

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.get(
                f"{IP_API_URL}/{ip}",
                params={"fields": "status,lat,lon,message"},
            )
        if response.status_code == 200:
            payload = response.json()
            if payload.get("status") == "success":
                return float(payload["lat"]), float(payload["lon"])
            errors.append(str(payload.get("message") or "ip-api failed"))
        else:
            errors.append(f"ip-api HTTP {response.status_code}")
    except httpx.HTTPError as exc:
        errors.append(f"ip-api: {exc}")

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.get(f"{IPWHO_URL}/{ip}")
        if response.status_code == 200:
            payload = response.json()
            if payload.get("success"):
                return float(payload["latitude"]), float(payload["longitude"])
            errors.append("ipwho failed")
        else:
            errors.append(f"ipwho HTTP {response.status_code}")
    except httpx.HTTPError as exc:
        errors.append(f"ipwho: {exc}")

    logger.warning("IP geolocation failed for %s: %s", ip, "; ".join(errors))
    raise AxonError("Unable to detect location from IP.", status_code=502)


async def fetch_coords_from_egress_ip() -> tuple[float, float]:
    """Resolve lat/lon from this machine's public egress IP (for localhost clients)."""
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.get(f"{IP_API_URL}/", params={"fields": "status,lat,lon,message"})
        if response.status_code == 200:
            payload = response.json()
            if payload.get("status") == "success":
                logger.info("[WEATHER] Egress geolocation: lat=%s lon=%s", payload.get("lat"), payload.get("lon"))
                return float(payload["lat"]), float(payload["lon"])
            logger.warning("[WEATHER] Egress geolocation failed: %s", payload.get("message"))
    except httpx.HTTPError as exc:
        logger.warning("[WEATHER] Egress geolocation error: %s", exc)
    raise AxonError("Unable to detect location.", status_code=502)


async def fetch_weather_for_client_ip(client_ip: str | None) -> dict:
    """Weather for the requesting device based on its public IP."""
    if not client_ip or client_ip in {"127.0.0.1", "::1"}:
        lat, lon = await fetch_coords_from_egress_ip()
    else:
        lat, lon = await fetch_coords_from_client_ip(client_ip)
    return await fetch_current_weather(lat, lon)


async def fetch_weather_by_city(city: str) -> dict:
    """Fetch weather by city name (e.g. ``Delhi,IN``)."""
    if not settings.openweather_api_key:
        raise AxonError("Weather API is not configured.", status_code=503)

    query = city.strip()
    if not query:
        raise AxonError("City is required.", status_code=400)

    params = {
        "q": query,
        "appid": settings.openweather_api_key,
        "units": "metric",
    }

    return await _request_openweather(params)


async def _request_openweather(params: dict) -> dict:
    logger.info("[WEATHER] API Request params=%s", {k: v for k, v in params.items() if k != "appid"})
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(OPENWEATHER_URL, params=params)
    except httpx.HTTPError as exc:
        logger.warning("[WEATHER] Error: %s", exc)
        raise AxonError("Unable to reach weather service.", status_code=502) from exc

    if response.status_code == 401:
        logger.warning("[WEATHER] Error: invalid API key")
        raise AxonError("Weather API key is invalid.", status_code=503)
    if response.status_code != 200:
        logger.warning("[WEATHER] Error HTTP %s: %s", response.status_code, response.text[:200])
        raise AxonError("Weather data is unavailable.", status_code=502)

    payload = response.json()
    logger.info(
        "[WEATHER] API Response location=%s temp=%s",
        payload.get("name"),
        (payload.get("main") or {}).get("temp"),
    )
    result = _normalize_openweather_payload(payload)
    coord = payload.get("coord") or {}
    lat = coord.get("lat")
    lon = coord.get("lon")
    if lat is not None and lon is not None:
        try:
            result["forecast"] = await fetch_forecast(float(lat), float(lon))
        except Exception as exc:  # noqa: BLE001
            logger.warning("[WEATHER] Forecast unavailable: %s", exc)
            result["forecast"] = []
    else:
        result["forecast"] = []
    return result


def _normalize_openweather_payload(payload: dict) -> dict:
    weather_entry = (payload.get("weather") or [{}])[0]
    main = payload.get("main") or {}
    sys_info = payload.get("sys") or {}

    code = int(weather_entry.get("id", 0))
    condition, default_label = _map_condition(code)
    label = str(weather_entry.get("main") or default_label).replace("_", " ").title()

    city = str(payload.get("name") or "").strip()
    country = str(sys_info.get("country") or "").strip()
    if city and country:
        location = f"{city}, {country}"
    else:
        location = city or country or "Current location"

    def round_temp(value: object) -> int | None:
        if value is None:
            return None
        return round(float(value))

    return {
        "temperature": round_temp(main.get("temp")) or 0,
        "unit": "celsius",
        "condition": condition,
        "label": label,
        "location": location,
        "feels_like": round_temp(main.get("feels_like")),
        "humidity": main.get("humidity"),
        "high": round_temp(main.get("temp_max")),
        "low": round_temp(main.get("temp_min")),
        "observedAt": datetime.now(UTC).isoformat(),
    }
