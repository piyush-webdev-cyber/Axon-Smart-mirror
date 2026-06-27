"""Device linking service."""

from __future__ import annotations

import json
import random
import secrets
import string
import uuid
from datetime import datetime, timedelta
from typing import Literal

from postgrest.exceptions import APIError
from supabase import Client

from app.core.config import settings
from app.core.errors import AxonError, NotFoundError, UnauthorizedError
from app.core.logging import get_logger

logger = get_logger(__name__)

StorageBackend = Literal["db", "storage", "memory"]
_STORAGE_PREFIX = "device-codes"
_MIRROR_TOKEN_PREFIX = "mirror-tokens"


class DeviceService:
    """Handles device code generation and linking."""

    CODE_LENGTH = 8
    CODE_PREFIX = "AXN-"
    CODE_EXPIRY_MINUTES = 15

    _dev_codes: dict[str, dict] = {}
    _storage_backend: StorageBackend = "db"
    _linked_meta: dict[str, dict] = {}

    def __init__(self, supabase_admin: Client):
        """Initialize with admin client (bypasses RLS)."""
        self.db = supabase_admin

    @classmethod
    def _activate_storage_backend(cls, reason: str) -> bool:
        if cls._storage_backend != "db":
            return cls._storage_backend == "storage"
        logger.warning(
            "%s Falling back to Supabase Storage for device codes (shared across backends). "
            "Run SUPABASE_DEVICE_CODES_FIX.sql in Supabase SQL Editor for the proper table.",
            reason,
        )
        cls._storage_backend = "storage"
        return True

    @classmethod
    def _activate_memory_backend(cls, reason: str) -> bool:
        if settings.is_production:
            logger.error(
                "%s Device linking requires Supabase device_codes table in production.",
                reason,
            )
            return False
        if not settings.debug:
            return False
        if cls._storage_backend == "memory":
            return True
        logger.warning(
            "%s Falling back to in-memory device codes (this process only). "
            "Phone linking via Vercel will NOT work until SUPABASE_DEVICE_CODES_FIX.sql is applied.",
            reason,
        )
        cls._storage_backend = "memory"
        return True

    @staticmethod
    def _is_missing_table(exc: APIError) -> bool:
        code = getattr(exc, "code", None)
        if code == "PGRST205":
            return True
        message = str(getattr(exc, "message", exc))
        return "PGRST205" in message or "device_codes" in message

    def _bucket(self):
        return self.db.storage.from_(settings.supabase_storage_bucket)

    def _storage_object_path(self, code: str) -> str:
        return f"{_STORAGE_PREFIX}/{code.strip().upper()}.json"

    def _storage_get(self, code: str) -> dict | None:
        normalized = code.strip().upper()
        try:
            raw = self._bucket().download(self._storage_object_path(normalized))
            record = json.loads(raw.decode("utf-8"))
            logger.info(
                "[DEVICE] storage hit | code=%s | status=%s | expires=%s",
                normalized,
                record.get("status"),
                record.get("expires_at"),
            )
            return record
        except Exception as exc:
            logger.debug("[DEVICE] storage miss | code=%s | reason=%s", normalized, exc)
            return None

    def _storage_put(self, record: dict) -> dict:
        code = record["code"].strip().upper()
        record = {**record, "code": code}
        payload = json.dumps(record).encode("utf-8")
        path = self._storage_object_path(code)
        self._bucket().upload(
            path,
            payload,
            file_options={"content-type": "application/json", "upsert": "true"},
        )
        logger.info(
            "[DEVICE] saved storage | code=%s | path=%s | status=%s | expires=%s",
            code,
            path,
            record.get("status"),
            record.get("expires_at"),
        )
        return record

    def _backup_linked_to_storage(self, record: dict) -> None:
        """Persist linked device record to storage for cross-instance mirror auth."""
        if not record.get("code") or record.get("status") != "linked":
            return
        try:
            self._storage_put(record)
        except Exception as exc:
            logger.warning(
                "[DEVICE] linked storage backup failed | code=%s | error=%s",
                record.get("code"),
                exc,
            )

    def _persist_mirror_token_index(
        self, mirror_token: str, user_id: str, code: str
    ) -> None:
        """Cross-instance mirror auth index (survives missing mirror_token DB column)."""
        payload = json.dumps(
            {
                "mirror_token": mirror_token,
                "user_id": user_id,
                "code": code.strip().upper(),
            }
        ).encode("utf-8")
        path = f"{_MIRROR_TOKEN_PREFIX}/{mirror_token}.json"
        try:
            self._bucket().upload(
                path,
                payload,
                file_options={"content-type": "application/json", "upsert": "true"},
            )
            logger.info(
                "[DEVICE] saved mirror token index | code=%s | user_id=%s | path=%s",
                code,
                user_id,
                path,
            )
        except Exception as exc:
            logger.warning(
                "[DEVICE] mirror token index save failed | code=%s | error=%s",
                code,
                exc,
            )

    def _memory_get(self, code: str) -> dict | None:
        return self._dev_codes.get(code.strip().upper())

    def _memory_put(self, record: dict) -> dict:
        code = record["code"].strip().upper()
        record = {**record, "code": code}
        self._dev_codes[code] = record
        return record

    async def _get_record(self, code: str) -> dict | None:
        code = code.strip().upper()
        if self._storage_backend == "storage":
            return self._storage_get(code)
        if self._storage_backend == "memory":
            return self._memory_get(code)
        return None

    def _generate_code(self) -> str:
        """Generate a unique device code like AXN-4832."""
        for _ in range(10):
            digits = "".join(random.choices(string.digits, k=4))
            code = f"{self.CODE_PREFIX}{digits}"
            if self._storage_backend == "memory" and code in self._dev_codes:
                continue
            if self._storage_backend == "storage" and self._storage_get(code):
                continue
            return code
        raise AxonError("Failed to generate unique device code", status_code=500)

    def _now_iso(self) -> str:
        return datetime.utcnow().isoformat() + "Z"

    def _persist_fallback_record(self, record: dict) -> dict:
        if self._storage_backend == "storage":
            return self._storage_put(record)
        return self._memory_put(record)

    def _mark_expired_fallback(self, code: str) -> None:
        if self._storage_backend == "storage":
            record = self._storage_get(code)
            if record:
                record["status"] = "expired"
                self._storage_put(record)
        elif self._storage_backend == "memory":
            record = self._memory_get(code)
            if record:
                record["status"] = "expired"
                self._memory_put(record)

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

    async def _ensure_mirror_token(self, code: str) -> str:
        """Return a stable mirror token for linked devices (multi-instance safe when DB has column)."""
        meta = self._linked_meta.get(code) or {}
        existing = meta.get("mirror_token")
        if isinstance(existing, str) and existing:
            return existing

        device_code = await self.get_device_code(code)
        if device_code and device_code.get("mirror_token"):
            token = str(device_code["mirror_token"])
            user_id = device_code.get("user_id")
            self._linked_meta[code] = {**meta, "mirror_token": token, "user_id": user_id}
            return token

        # Storage backup from a prior link (db column may be missing)
        if self._storage_backend == "db":
            stored = self._storage_get(code)
            if stored and stored.get("mirror_token"):
                token = str(stored["mirror_token"])
                user_id = stored.get("user_id")
                self._linked_meta[code] = {**meta, "mirror_token": token, "user_id": user_id}
                return token

        if device_code and device_code.get("status") == "linked" and not device_code.get("mirror_token"):
            user_id = device_code.get("user_id")
        else:
            user_id = device_code.get("user_id") if device_code else meta.get("user_id")

        token = secrets.token_urlsafe(32)
        self._linked_meta[code] = {**meta, "mirror_token": token, "user_id": user_id}

        if self._storage_backend in ("storage", "memory") and code:
            record = self._storage_get(code) if self._storage_backend == "storage" else self._memory_get(code)
            if record:
                record["mirror_token"] = token
                self._persist_fallback_record(record)
            if user_id:
                self._persist_mirror_token_index(token, str(user_id), code)
            return token

        try:
            self.db.table("device_codes").update({"mirror_token": token}).eq("code", code).execute()
        except APIError as exc:
            logger.warning("Could not persist mirror_token for %s: %s", code, exc)
        except Exception as exc:  # noqa: BLE001
            logger.warning("mirror_token persist failed for %s: %s", code, exc)

        if user_id:
            self._persist_mirror_token_index(token, str(user_id), code)
            if device_code:
                backup = {**device_code, "mirror_token": token, "code": code}
                self._backup_linked_to_storage(backup)

        return token

    async def verify_mirror_session(self, code: str, user_id: str) -> dict:
        """Verify mirror kiosk session and ensure a persisted mirror token."""
        status = await self.check_device_status(code)
        if status.get("status") != "linked":
            raise UnauthorizedError("Mirror is not linked.")
        if str(status.get("user_id")) != str(user_id):
            raise UnauthorizedError("Invalid mirror session.")

        token = status.get("mirror_token")
        if not token:
            token = await self._ensure_mirror_token(code)
            status["mirror_token"] = token

        self._persist_mirror_token_index(token, str(user_id), code)
        record = await self.get_device_code(code)
        if record:
            self._backup_linked_to_storage({**record, "mirror_token": token, "code": code})

        return status

    async def create_device_code(self) -> dict:
        """Create a new device code for linking."""
        logger.info("[DEVICE] generate start | backend=%s", self._storage_backend)
        code = self._generate_code()
        expires_at = datetime.utcnow() + timedelta(minutes=self.CODE_EXPIRY_MINUTES)
        logger.info(
            "[DEVICE] generated code=%s | expires=%s | backend=%s",
            code,
            expires_at.isoformat() + "Z",
            self._storage_backend,
        )
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
            "mirror_token": None,
        }

        if self._storage_backend == "storage":
            saved = self._storage_put(record)
            logger.info("[DEVICE] saved storage (create) | code=%s", code)
            return saved

        if self._storage_backend == "memory":
            saved = self._memory_put(record)
            logger.info("[DEVICE] saved memory (create) | code=%s", code)
            return saved

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
            logger.info(
                "[DEVICE] saved db | code=%s | id=%s | expires=%s",
                code,
                device_code.get("id"),
                device_code.get("expires_at"),
            )
            return device_code

        except APIError as exc:
            logger.error("Failed to create device code: %s", exc)
            if self._is_missing_table(exc) and self._activate_storage_backend("device_codes table missing."):
                try:
                    return self._storage_put(record)
                except Exception as storage_exc:  # noqa: BLE001
                    logger.error("Storage device code create failed: %s", storage_exc)
                    if self._activate_memory_backend("Storage unavailable."):
                        return self._memory_put(record)
            raise AxonError("Failed to create device code", status_code=500) from exc
        except Exception as exc:
            logger.error("Failed to create device code: %s", exc)
            raise AxonError("Failed to create device code", status_code=500) from exc

    async def get_device_code(self, code: str) -> dict | None:
        """Fetch device code by code string."""
        code = code.strip().upper()
        logger.info("[DEVICE] lookup start | code=%s | backend=%s", code, self._storage_backend)

        if self._storage_backend == "storage":
            return self._storage_get(code)
        if self._storage_backend == "memory":
            found = self._memory_get(code)
            logger.info("[DEVICE] lookup memory | code=%s | found=%s", code, bool(found))
            return found

        try:
            result = (
                self.db.table("device_codes")
                .select("*")
                .eq("code", code)
                .maybe_single()
                .execute()
            )
            if result.data:
                logger.info(
                    "[DEVICE] lookup db hit | code=%s | status=%s | expires=%s | user_id=%s",
                    code,
                    result.data.get("status"),
                    result.data.get("expires_at"),
                    result.data.get("user_id"),
                )
                return result.data

            logger.warning("[DEVICE] lookup db miss | code=%s — checking storage fallback", code)
            stored = self._storage_get(code)
            if stored:
                return stored

            logger.warning("[DEVICE] lookup not found | code=%s", code)
            return None

        except APIError as exc:
            logger.error("[DEVICE] lookup db error | code=%s | error=%s", code, exc)
            if self._is_missing_table(exc) and self._activate_storage_backend("device_codes table missing."):
                stored = self._storage_get(code)
                if stored:
                    return stored
                if self._activate_memory_backend("Storage read after table missing."):
                    return self._memory_get(code)
            stored = self._storage_get(code)
            if stored:
                logger.info("[DEVICE] lookup storage fallback after error | code=%s", code)
                return stored
            return None
        except Exception as exc:
            logger.exception("[DEVICE] lookup failed | code=%s | error=%s", code, exc)
            stored = self._storage_get(code)
            if stored:
                return stored
            return None

    async def link_device(self, code: str, user_id: str) -> dict:
        """Link a device code to a user account."""
        code = code.strip().upper()
        logger.info("[DEVICE] link start | code=%s | user_id=%s", code, user_id)
        device_code = await self.get_device_code(code)

        if not device_code:
            logger.warning("[DEVICE] link failure | code=%s | reason=not_found", code)
            raise NotFoundError(
                f"Device code '{code}' was not found. Scan a fresh QR code on your mirror."
            )

        expires_at = self._parse_expires_at(device_code["expires_at"])
        if datetime.utcnow() > expires_at:
            logger.warning(
                "[DEVICE] link failure | code=%s | reason=expired | expired_at=%s",
                code,
                device_code.get("expires_at"),
            )
            if self._storage_backend == "db":
                try:
                    self.db.table("device_codes").update({"status": "expired"}).eq("code", code).execute()
                except APIError:
                    self._mark_expired_fallback(code)
            else:
                self._mark_expired_fallback(code)
            raise AxonError("Device code has expired", status_code=400)

        if device_code["status"] == "linked":
            logger.warning("[DEVICE] link failure | code=%s | reason=already_linked", code)
            raise AxonError("Device code already linked", status_code=400)

        display_name, avatar_url = self._fetch_user_display(user_id)
        email = self._fetch_user_email(user_id)
        mirror_token = secrets.token_urlsafe(32)
        logger.info("[DEVICE] link proceeding | code=%s | user_id=%s", code, user_id)

        if self._storage_backend in ("storage", "memory"):
            record = {
                **device_code,
                "user_id": user_id,
                "status": "linked",
                "display_name": display_name,
                "avatar_url": avatar_url,
                "email": email,
                "mirror_token": mirror_token,
                "updated_at": self._now_iso(),
            }
            linked = self._persist_fallback_record(record)
            self._persist_mirror_token_index(mirror_token, user_id, code)
            logger.info("[DEVICE] link success (storage) | code=%s | user_id=%s", code, user_id)
            return linked

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

            logger.info(
                "[DEVICE] link success (db) | code=%s | user_id=%s | mirror_token=%s…",
                code,
                user_id,
                mirror_token[:8],
            )
            linked = result.data[0]
            linked["mirror_token"] = mirror_token
            self._linked_meta[code] = {
                "mirror_token": mirror_token,
                "user_id": user_id,
                "display_name": display_name,
                "avatar_url": avatar_url,
                "email": email,
            }
            self._persist_mirror_token_index(mirror_token, user_id, code)
            self._backup_linked_to_storage({
                **linked,
                "code": code,
                "mirror_token": mirror_token,
                "display_name": display_name,
                "avatar_url": avatar_url,
                "email": email,
            })
            return linked

        except APIError as exc:
            if self._is_missing_table(exc) and self._activate_storage_backend("device_codes table missing."):
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
                    "user_id": user_id,
                    "display_name": display_name,
                    "avatar_url": avatar_url,
                    "email": email,
                }
                self._persist_mirror_token_index(mirror_token, user_id, code)
                self._backup_linked_to_storage({
                    **record,
                    "code": code,
                    "mirror_token": mirror_token,
                    "display_name": display_name,
                    "avatar_url": avatar_url,
                    "email": email,
                })
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
            logger.warning("[DEVICE] status failure | code=%s | reason=not_found", code)
            raise NotFoundError(
                f"Device code '{code}' was not found. Scan a fresh QR code on your mirror."
            )

        expires_at = self._parse_expires_at(device_code["expires_at"])
        if datetime.utcnow() > expires_at and device_code["status"] == "pending":
            logger.warning(
                "[DEVICE] status expired | code=%s | expired_at=%s",
                code,
                device_code.get("expires_at"),
            )
            if self._storage_backend == "db":
                try:
                    self.db.table("device_codes").update({"status": "expired"}).eq("code", code).execute()
                except APIError:
                    self._mark_expired_fallback(code)
            else:
                self._mark_expired_fallback(code)
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
            if not response.get("mirror_token"):
                response["mirror_token"] = await self._ensure_mirror_token(code)

            if not response["display_name"] or not response["email"]:
                display_name, avatar_url = self._fetch_user_display(device_code["user_id"])
                email = self._fetch_user_email(device_code["user_id"])
                if not response["display_name"]:
                    response["display_name"] = display_name
                response["avatar_url"] = response["avatar_url"] or avatar_url
                if not response["email"]:
                    response["email"] = email
                if self._storage_backend in ("storage", "memory"):
                    record = {**device_code, **response, "updated_at": self._now_iso()}
                    self._persist_fallback_record(record)

        return response
