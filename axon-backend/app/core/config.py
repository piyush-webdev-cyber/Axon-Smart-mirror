"""Centralized, typed application settings.

Single source of truth for configuration. Values load from environment
variables (and a local `.env` file in development) and are validated by Pydantic
at startup, so misconfiguration fails fast and loudly.
"""

from __future__ import annotations

import json
from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # --- App ---------------------------------------------------------------
    env: str = Field(default="development", alias="AXON_ENV")
    debug: bool = Field(default=True, alias="AXON_DEBUG")
    api_prefix: str = Field(default="/api/v1", alias="AXON_API_PREFIX")
    version: str = Field(default="0.1.0", alias="AXON_VERSION")
    service_name: str = "axon-backend"
    phase: int = 1

    # --- CORS --------------------------------------------------------------
    # Type is str | list[str] to allow env var to be comma-separated or JSON
    cors_origins: str | list[str] = Field(
        default="http://localhost:5173",
        alias="AXON_CORS_ORIGINS",
    )

    # --- Supabase ----------------------------------------------------------
    supabase_url: str = Field(default="", alias="SUPABASE_URL")
    supabase_anon_key: str = Field(default="", alias="SUPABASE_ANON_KEY")
    supabase_service_role_key: str = Field(
        default="", alias="SUPABASE_SERVICE_ROLE_KEY"
    )
    supabase_jwt_secret: str = Field(default="", alias="SUPABASE_JWT_SECRET")
    supabase_storage_bucket: str = Field(
        default="axon-media", alias="SUPABASE_STORAGE_BUCKET"
    )

    # --- AI (reserved) -----------------------------------------------------
    gemini_api_key: str = Field(default="", alias="GEMINI_API_KEY")

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, value: object) -> list[str]:
        """Allow comma-separated string or JSON array from environment."""
        if isinstance(value, str):
            value = value.strip()
            # Handle empty string
            if not value:
                return ["http://localhost:5173"]
            # If it looks like JSON, let Pydantic handle it
            if value.startswith("["):
                try:
                    return json.loads(value)
                except json.JSONDecodeError:
                    pass
            # Otherwise treat as comma-separated
            return [item.strip() for item in value.split(",") if item.strip()]
        if isinstance(value, list):
            return value
        # Fallback to default
        return ["http://localhost:5173"]

    @property
    def is_production(self) -> bool:
        return self.env.lower() in {"production", "prod"}

    def get_cors_origins(self) -> list[str]:
        """Always returns CORS origins as a list."""
        if isinstance(self.cors_origins, list):
            return self.cors_origins
        # This should never happen after validation, but just in case
        if isinstance(self.cors_origins, str):
            return [
                item.strip()
                for item in self.cors_origins.split(",")
                if item.strip()
            ]
        return ["http://localhost:5173"]


@lru_cache
def get_settings() -> Settings:
    """Cached settings accessor used across the app and as a FastAPI dependency."""
    return Settings()


settings = get_settings()
