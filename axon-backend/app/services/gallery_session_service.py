"""Temporary gallery sessions for QR phone access."""

from __future__ import annotations

import secrets
import uuid
from datetime import datetime, timedelta

from postgrest.exceptions import APIError
from supabase import Client

from app.core.config import settings
from app.core.errors import AxonError
from app.core.logging import get_logger

logger = get_logger(__name__)

SESSION_EXPIRY_MINUTES = 15


class GallerySessionService:
    """Creates and validates short-lived gallery access sessions."""

    _dev_sessions: dict[str, dict] = {}
    _dev_mode: bool = False

    def __init__(self, supabase: Client):
        self.db = supabase

    @classmethod
    def _activate_dev_mode(cls, reason: str) -> bool:
        if not settings.debug:
            return False
        if not cls._dev_mode:
            logger.warning(
                "%s Using in-memory gallery sessions (dev only). "
                "Apply migration 0005 for production.",
                reason,
            )
            cls._dev_mode = True
        return True

    @staticmethod
    def _is_missing_table(exc: Exception) -> bool:
        if isinstance(exc, APIError):
            code = getattr(exc, "code", None)
            if code == "PGRST205":
                return True
        message = str(getattr(exc, "message", exc))
        return "PGRST205" in message or "gallery_sessions" in message.lower()

    def _create_dev_session(self, user_id: str) -> dict:
        token = secrets.token_urlsafe(32)
        expires_at = datetime.utcnow() + timedelta(minutes=SESSION_EXPIRY_MINUTES)
        record = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "token": token,
            "expires_at": expires_at.isoformat() + "Z",
            "created_at": datetime.utcnow().isoformat() + "Z",
        }
        self._dev_sessions[token] = record
        logger.info("Created dev gallery session for user %s", user_id)
        return {
            "token": record["token"],
            "expires_at": record["expires_at"],
            "session_id": record["id"],
        }

    def _get_dev_session(self, token: str) -> dict | None:
        session = self._dev_sessions.get(token)
        if not session:
            return None
        expires_raw = session["expires_at"]
        expires_at = datetime.fromisoformat(expires_raw.replace("Z", "+00:00"))
        if expires_at.tzinfo:
            expires_at = expires_at.replace(tzinfo=None)
        if datetime.utcnow() > expires_at:
            del self._dev_sessions[token]
            return None
        return session

    async def create_session(self, user_id: str) -> dict:
        if self._dev_mode:
            return self._create_dev_session(user_id)

        token = secrets.token_urlsafe(32)
        expires_at = datetime.utcnow() + timedelta(minutes=SESSION_EXPIRY_MINUTES)

        try:
            result = (
                self.db.table("gallery_sessions")
                .insert(
                    {
                        "user_id": user_id,
                        "token": token,
                        "expires_at": expires_at.isoformat() + "Z",
                    }
                )
                .execute()
            )

            if not result.data:
                raise AxonError("Failed to create gallery session", status_code=500)

            record = result.data[0]
            logger.info("Created gallery session for user %s", user_id)
            return {
                "token": record["token"],
                "expires_at": record["expires_at"],
                "session_id": record["id"],
            }
        except Exception as exc:
            if self._is_missing_table(exc) and self._activate_dev_mode(
                "gallery_sessions table missing."
            ):
                return self._create_dev_session(user_id)
            logger.error("Failed to create gallery session: %s", exc)
            raise AxonError("Failed to create gallery session", status_code=500) from exc

    async def get_session(self, token: str) -> dict:
        if self._dev_mode:
            session = self._get_dev_session(token)
            if not session:
                raise AxonError("Gallery session not found or expired", status_code=404)
            return session

        try:
            result = (
                self.db.table("gallery_sessions")
                .select("*")
                .eq("token", token)
                .maybe_single()
                .execute()
            )

            if not result.data:
                raise AxonError("Gallery session not found", status_code=404)

            session = result.data
            expires_raw = session["expires_at"]
            expires_at = datetime.fromisoformat(expires_raw.replace("Z", "+00:00"))
            if expires_at.tzinfo:
                expires_at = expires_at.replace(tzinfo=None)

            if datetime.utcnow() > expires_at:
                raise AxonError("Gallery session has expired", status_code=410)

            return session
        except AxonError:
            raise
        except Exception as exc:
            if self._is_missing_table(exc) and self._activate_dev_mode(
                "gallery_sessions table missing."
            ):
                session = self._get_dev_session(token)
                if not session:
                    raise AxonError("Gallery session not found or expired", status_code=404)
                return session
            raise AxonError("Gallery session not found", status_code=404) from exc
