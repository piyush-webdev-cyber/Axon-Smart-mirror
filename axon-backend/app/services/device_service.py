"""Device linking service."""

from __future__ import annotations

import random
import secrets
import string
import uuid
from datetime import datetime, timedelta

from postgrest.exceptions import APIError
from supabase import Client

from app.core.config import settings
from app.core.errors import AxonError
from app.core.logging import get_logger

logger = get_logger(__name__)


class DeviceService:
    """Handles device code generation and linking."""

    CODE_LENGTH = 8
    CODE_PREFIX = "AXN-"
    CODE_EXPIRY_MINUTES = 15

    # In-memory fallback for local dev when Supabase schema is not migrated yet.
    _dev_codes: dict[str, dict] = {}
    _dev_mode: bool = False
    # Process-local mirror tokens when DB row lacks mirror_token column
    _linked_meta: dict[str, dict] = {}

    def __init__(self, supabase_admin: Client):
        """Initialize with admin client (bypasses RLS)."""
        self.db = supabase_admin

    @classmethod
    def _activate_dev_mode(cls, reason: str) -> bool:
        if settings.is_production:
            logger.error(
                "%s Device linking requires Supabase (device_codes table) in production.",
                reason,
            )
            return False
        if not settings.debug:
            return False
        if not cls._dev_mode:
            logger.warning(
                "%s Falling back to in-memory device codes (dev only). "
                "Run SUPABASE_SETUP.sql for production.",
                reason,
            )
            cls._dev_mode = True
        return True

    @staticmethod
    def _is_missing_table(exc: APIError) -> bool:
        code = getattr(exc, "code", None)
        if code == "PGRST205":
            return True
        message = str(getattr(exc, "message", exc))
        return "PGRST205" in message or "device_codes" in message

    def _generate_code(self) -> str:
        """Generate a unique device code like AXN-4832."""
        for _ in range(10):
            digits = "".join(random.choices(string.digits, k=4))
            code = f"{self.CODE_PREFIX}{digits}"
            if code not in self._dev_codes:
                return code
        raise AxonError("Failed to generate unique device code", status_code=500)

    def _now_iso(self) -> str:
        return datetime.utcnow().isoformat() + "Z"

    def _create_dev_record(self, code: str, expires_at: datetime) -> dict:
        record = {
            "id": str(uuid.uuid4()),
            "code": code,
            "status": "pending",
            "user_id": None,
            "expires_at": expires_at.isoformat() + "Z",
            "created_at": self._now_iso(),
            "updated_at": self._now_iso(),
            "display_name": None,
            "avatar_url": None,
        }
        self._dev_codes[code] = record
        return record

    def _get_dev_record(self, code: str) -> dict | None:
        return self._dev_codes.get(code)

    def _parse_expires_at(self, value: str) -> datetime:
        normalized = value.replace("Z", "+00:00")
        if "+" not in normalized and normalized.count("-") <= 2:
            normalized += "+00:00"
        return datetime.fromisoformat(normalized).replace(tzinfo=None)

    def _fetch_user_display(self, user_id: str) -> tuple[str | None, str | None]:
        try:
            profile_result = (
                self.db.table("profiles")
                .select("display_name, avatar_url")
                .eq("id", user_id)
                .maybe_single()
                .execute()
            )
            if profile_result.data:
                return (
                    profile_result.data.get("display_name"),
                    profile_result.data.get("avatar_url"),
                )
        except Exception as exc:
            logger.warning("Profile lookup failed for %s: %s", user_id, exc)

        try:
            auth_user = self.db.auth.admin.get_user_by_id(user_id)
            user = getattr(auth_user, "user", None) or auth_user
            metadata = getattr(user, "user_metadata", None) or {}
            display_name = metadata.get("full_name") or metadata.get("name")
            avatar_url = metadata.get("avatar_url")
            email = getattr(user, "email", None)
            if not display_name and email:
                display_name = email.split("@")[0]
            return display_name, avatar_url
        except Exception as exc:
            logger.warning("Auth user lookup failed for %s: %s", user_id, exc)

        return None, None

    def _fetch_user_email(self, user_id: str) -> str | None:
        try:
            auth_user = self.db.auth.admin.get_user_by_id(user_id)
            user = getattr(auth_user, "user", None) or auth_user
            email = getattr(user, "email", None)
            if isinstance(email, str) and email.strip():
                return email
        except Exception as exc:
            logger.warning("Email lookup failed for %s: %s", user_id, exc)
        return None

    async def create_device_code(self) -> dict:
        """Create a new device code for linking."""
        code = self._generate_code()
        expires_at = datetime.utcnow() + timedelta(minutes=self.CODE_EXPIRY_MINUTES)

        if self._dev_mode:
            record = self._create_dev_record(code, expires_at)
            logger.info("Created dev device code: %s", code)
            return record

        try:
            result = (
                self.db.table("device_codes")
                .insert(
                    {
                        "code": code,
                        "status": "pending",
                        "expires_at": expires_at.isoformat(),
                    }
                )
                .execute()
            )

            if not result.data:
                raise AxonError("Failed to create device code", status_code=500)

            device_code = result.data[0]
            logger.info("Created device code: %s (expires: %s)", code, expires_at)
            return device_code

        except APIError as exc:
            logger.error("Failed to create device code: %s", exc)
            if self._is_missing_table(exc) and self._activate_dev_mode("device_codes table missing."):
                return self._create_dev_record(code, expires_at)
            raise AxonError("Failed to create device code", status_code=500) from exc
        except Exception as exc:
            logger.error("Failed to create device code: %s", exc)
            raise AxonError("Failed to create device code", status_code=500) from exc

    async def get_device_code(self, code: str) -> dict | None:
        """Fetch device code by code string."""
        code = code.strip().upper()
        if self._dev_mode:
            return self._get_dev_record(code)

        try:
            result = (
                self.db.table("device_codes")
                .select("*")
                .eq("code", code)
                .maybe_single()
                .execute()
            )
            return result.data

        except APIError as exc:
            if self._is_missing_table(exc) and self._activate_dev_mode("device_codes table missing."):
                return self._get_dev_record(code)
            logger.error("Failed to fetch device code %s: %s", code, exc)
            return None
        except Exception as exc:
            logger.error("Failed to fetch device code %s: %s", code, exc)
            return None

    async def link_device(self, code: str, user_id: str) -> dict:
        """Link a device code to a user account."""
        code = code.strip().upper()
        device_code = await self.get_device_code(code)

        if not device_code:
            raise AxonError("Invalid device code", status_code=404)

        expires_at = self._parse_expires_at(device_code["expires_at"])
        if datetime.utcnow() > expires_at:
            if self._dev_mode and code in self._dev_codes:
                self._dev_codes[code]["status"] = "expired"
            else:
                self.db.table("device_codes").update({"status": "expired"}).eq("code", code).execute()
            raise AxonError("Device code has expired", status_code=400)

        if device_code["status"] == "linked":
            raise AxonError("Device code already linked", status_code=400)

        display_name, avatar_url = self._fetch_user_display(user_id)
        email = self._fetch_user_email(user_id)

        if self._dev_mode:
            record = self._dev_codes[code]
            mirror_token = secrets.token_urlsafe(32)
            record.update(
                {
                    "user_id": user_id,
                    "status": "linked",
                    "display_name": display_name,
                    "avatar_url": avatar_url,
                    "email": email,
                    "mirror_token": mirror_token,
                    "updated_at": self._now_iso(),
                }
            )
            logger.info("Linked dev device %s to user %s", code, user_id)
            return record

        mirror_token = secrets.token_urlsafe(32)
        try:
            update_payload: dict = {
                "user_id": user_id,
                "status": "linked",
                "mirror_token": mirror_token,
            }
            result = (
                self.db.table("device_codes")
                .update(update_payload)
                .eq("code", code)
                .execute()
            )

            if not result.data:
                raise AxonError("Failed to link device", status_code=500)

            logger.info("Linked device %s to user %s", code, user_id)
            linked = result.data[0]
            linked["mirror_token"] = mirror_token
            self._linked_meta[code] = {
                "mirror_token": mirror_token,
                "display_name": display_name,
                "avatar_url": avatar_url,
                "email": email,
            }
            return linked

        except APIError as exc:
            if self._is_missing_table(exc) and self._activate_dev_mode(
                "device_codes table missing."
            ):
                return await self.link_device(code, user_id)
            # mirror_token column may be missing before migration 0005
            if "mirror_token" in str(exc).lower() or getattr(exc, "code", None) == "PGRST204":
                logger.warning("mirror_token column missing; linking without token column")
                result = (
                    self.db.table("device_codes")
                    .update({"user_id": user_id, "status": "linked"})
                    .eq("code", code)
                    .execute()
                )
                if not result.data:
                    raise AxonError("Failed to link device", status_code=500) from exc
                record = result.data[0]
                record["mirror_token"] = mirror_token
                self._linked_meta[code] = {
                    "mirror_token": mirror_token,
                    "display_name": display_name,
                    "avatar_url": avatar_url,
                    "email": email,
                }
                return record
            logger.error("Failed to link device %s: %s", code, exc)
            raise AxonError("Failed to link device", status_code=500) from exc
        except Exception as exc:
            logger.error("Failed to link device %s: %s", code, exc)
            raise AxonError("Failed to link device", status_code=500) from exc

    async def check_device_status(self, code: str) -> dict:
        """Check the status of a device code."""
        code = code.strip().upper()
        device_code = await self.get_device_code(code)

        if not device_code:
            raise AxonError("Invalid device code", status_code=404)

        expires_at = self._parse_expires_at(device_code["expires_at"])
        if datetime.utcnow() > expires_at and device_code["status"] == "pending":
            if self._dev_mode and code in self._dev_codes:
                self._dev_codes[code]["status"] = "expired"
            else:
                self.db.table("device_codes").update({"status": "expired"}).eq("code", code).execute()
            return {
                "status": "expired",
                "user_id": None,
                "display_name": None,
                "avatar_url": None,
            }

        response = {
            "status": device_code["status"],
            "user_id": device_code.get("user_id"),
            "display_name": device_code.get("display_name"),
            "avatar_url": device_code.get("avatar_url"),
            "email": device_code.get("email"),
            "mirror_token": device_code.get("mirror_token"),
        }

        meta = self._linked_meta.get(code)
        if meta:
            for key in ("mirror_token", "display_name", "avatar_url", "email"):
                if not response.get(key) and meta.get(key):
                    response[key] = meta[key]

        if device_code["status"] == "linked" and device_code.get("user_id"):
            if not response["display_name"] or not response["email"]:
                display_name, avatar_url = self._fetch_user_display(device_code["user_id"])
                email = self._fetch_user_email(device_code["user_id"])
                if not response["display_name"]:
                    response["display_name"] = display_name
                response["avatar_url"] = response["avatar_url"] or avatar_url
                if not response["email"]:
                    response["email"] = email
                if self._dev_mode and code in self._dev_codes:
                    self._dev_codes[code]["display_name"] = response["display_name"]
                    self._dev_codes[code]["avatar_url"] = response["avatar_url"]
                    self._dev_codes[code]["email"] = response["email"]

        return response
