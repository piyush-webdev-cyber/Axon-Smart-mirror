"""Photo management service."""

from __future__ import annotations

import base64
import io
import uuid
from datetime import datetime, timedelta

from PIL import Image
from postgrest.exceptions import APIError
from supabase import Client

from app.core.config import settings
from app.core.errors import AxonError
from app.core.logging import get_logger

logger = get_logger(__name__)


class PhotoService:
    """Handles photo storage and retrieval."""

    THUMBNAIL_SIZE = (400, 400)
    MAX_DIMENSION = 1920
    JPEG_QUALITY = 85
    SIGNED_URL_EXPIRY_SECONDS = 3600
    SHARE_URL_EXPIRY_MINUTES = 15

    # In-memory fallback when Supabase schema/storage is not ready (local dev).
    _dev_photos: dict[str, list[dict]] = {}
    _dev_mode: bool = False

    def __init__(self, supabase: Client):
        self.db = supabase
        self.storage = supabase.storage
        self.bucket = settings.supabase_storage_bucket

    @classmethod
    def _activate_dev_mode(cls, reason: str) -> bool:
        if not settings.debug:
            return False
        if not cls._dev_mode:
            logger.warning(
                "%s Using in-memory photo store (dev only). "
                "Apply axon-backend/migrations for production.",
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
        return "PGRST205" in message or "photos" in message.lower()

    @staticmethod
    def _bytes_to_data_url(data: bytes) -> str:
        encoded = base64.b64encode(data).decode("ascii")
        return f"data:image/jpeg;base64,{encoded}"

    def _compress_image(self, image_data: bytes) -> tuple[bytes, int, int]:
        try:
            img = Image.open(io.BytesIO(image_data))
            width, height = img.size

            if max(width, height) > self.MAX_DIMENSION:
                img.thumbnail((self.MAX_DIMENSION, self.MAX_DIMENSION), Image.Resampling.LANCZOS)
                width, height = img.size

            if img.mode in ("RGBA", "LA", "P"):
                background = Image.new("RGB", img.size, (255, 255, 255))
                if img.mode == "P":
                    img = img.convert("RGBA")
                background.paste(
                    img,
                    mask=img.split()[-1] if img.mode in ("RGBA", "LA") else None,
                )
                img = background
            elif img.mode != "RGB":
                img = img.convert("RGB")

            output = io.BytesIO()
            img.save(output, format="JPEG", quality=self.JPEG_QUALITY, optimize=True)
            data = output.getvalue()
            return data, width, height
        except Exception as exc:
            logger.error("Failed to compress image: %s", exc)
            raise AxonError("Failed to process image", status_code=500) from exc

    def _generate_thumbnail(self, image_data: bytes) -> bytes:
        try:
            img = Image.open(io.BytesIO(image_data))
            img.thumbnail(self.THUMBNAIL_SIZE, Image.Resampling.LANCZOS)

            if img.mode != "RGB":
                if img.mode in ("RGBA", "LA", "P"):
                    background = Image.new("RGB", img.size, (255, 255, 255))
                    if img.mode == "P":
                        img = img.convert("RGBA")
                    background.paste(
                        img,
                        mask=img.split()[-1] if img.mode in ("RGBA", "LA") else None,
                    )
                    img = background
                else:
                    img = img.convert("RGB")

            output = io.BytesIO()
            img.save(output, format="JPEG", quality=self.JPEG_QUALITY, optimize=True)
            return output.getvalue()
        except Exception as exc:
            logger.error("Failed to generate thumbnail: %s", exc)
            raise AxonError("Failed to generate thumbnail", status_code=500) from exc

    def _build_storage_paths(self, user_id: str, filename: str) -> tuple[str, str, str]:
        now = datetime.utcnow()
        year = now.strftime("%Y")
        month = now.strftime("%m")
        timestamp = int(now.timestamp())
        safe_name = f"photo_{timestamp}.jpg"

        base = f"{user_id}/photos/{year}/{month}"
        storage_path = f"{base}/{safe_name}"
        thumbnail_path = f"{base}/thumbnails/{safe_name}"
        return storage_path, thumbnail_path, safe_name

    def _upload_to_storage(self, storage_path: str, thumbnail_path: str, compressed: bytes) -> None:
        self.storage.from_(self.bucket).upload(
            storage_path,
            compressed,
            file_options={"content-type": "image/jpeg", "upsert": False},
        )
        thumbnail_data = self._generate_thumbnail(compressed)
        self.storage.from_(self.bucket).upload(
            thumbnail_path,
            thumbnail_data,
            file_options={"content-type": "image/jpeg", "upsert": False},
        )

    def _create_signed_url(self, storage_path: str, expires_seconds: int | None = None) -> str:
        expiry = expires_seconds or self.SIGNED_URL_EXPIRY_SECONDS
        signed = self.storage.from_(self.bucket).create_signed_url(storage_path, expiry)
        if not signed or "signedURL" not in signed:
            raise AxonError("Failed to create signed URL", status_code=500)
        return signed["signedURL"]

    def _enrich_dev_photo(self, photo: dict) -> dict:
        enriched = {k: v for k, v in photo.items() if not k.startswith("_dev_")}
        meta = enriched.get("metadata") or {}
        image_url = photo.get("_dev_image_url") or meta.get("dev_image_url")
        thumb_url = photo.get("_dev_thumbnail_url") or meta.get("dev_thumbnail_url")
        enriched["thumbnail_url"] = thumb_url
        enriched["image_url"] = image_url
        return enriched

    def enrich_photo(self, photo: dict) -> dict:
        if photo.get("_dev_image_url") or (photo.get("metadata") or {}).get("dev_image_url"):
            return self._enrich_dev_photo(photo)

        enriched = dict(photo)
        try:
            if photo.get("thumbnail_path"):
                enriched["thumbnail_url"] = self._create_signed_url(photo["thumbnail_path"])
            if photo.get("storage_path"):
                enriched["image_url"] = self._create_signed_url(photo["storage_path"])
        except Exception as exc:
            logger.warning("Failed to enrich photo URLs: %s", exc)
            enriched.setdefault("thumbnail_url", None)
            enriched.setdefault("image_url", None)
        return enriched

    def _create_dev_photo(
        self,
        user_id: str,
        compressed: bytes,
        thumbnail_data: bytes,
        *,
        storage_path: str,
        thumbnail_path: str,
        file_name: str,
        width: int,
        height: int,
        caption: str | None,
        metadata: dict | None,
    ) -> dict:
        photo_id = str(uuid.uuid4())
        image_url = self._bytes_to_data_url(compressed)
        thumb_url = self._bytes_to_data_url(thumbnail_data)
        now = datetime.utcnow().isoformat() + "Z"

        record = {
            "id": photo_id,
            "user_id": user_id,
            "storage_path": storage_path,
            "thumbnail_path": thumbnail_path,
            "file_name": file_name,
            "file_size": len(compressed),
            "width": width,
            "height": height,
            "caption": caption,
            "metadata": {
                **(metadata or {}),
                "file_name": file_name,
                "file_size": len(compressed),
                "width": width,
                "height": height,
                "dev_image_url": image_url,
                "dev_thumbnail_url": thumb_url,
            },
            "created_at": now,
            "deleted_at": None,
            "_dev_image_url": image_url,
            "_dev_thumbnail_url": thumb_url,
        }
        self._dev_photos.setdefault(user_id, []).insert(0, record)
        logger.info("Stored dev photo %s for user %s", photo_id, user_id)
        return self._enrich_dev_photo(record)

    def _list_dev_photos(self, user_id: str, page: int, page_size: int) -> dict:
        items = [
            p for p in self._dev_photos.get(user_id, []) if not p.get("deleted_at")
        ]
        total = len(items)
        offset = (page - 1) * page_size
        page_items = items[offset : offset + page_size]
        photos = [self._enrich_dev_photo(p) for p in page_items]
        return {
            "photos": photos,
            "total": total,
            "page": page,
            "page_size": page_size,
            "has_more": total > page * page_size,
        }

    def _get_dev_photo(self, photo_id: str, user_id: str) -> dict | None:
        for photo in self._dev_photos.get(user_id, []):
            if photo["id"] == photo_id and not photo.get("deleted_at"):
                return photo
        return None

    async def create_photo(
        self,
        user_id: str,
        image_data: bytes,
        filename: str,
        caption: str | None = None,
        metadata: dict | None = None,
    ) -> dict:
        try:
            compressed, width, height = self._compress_image(image_data)
            thumbnail_data = self._generate_thumbnail(compressed)
            storage_path, thumbnail_path, file_name = self._build_storage_paths(user_id, filename)

            if self._dev_mode:
                return self._create_dev_photo(
                    user_id,
                    compressed,
                    thumbnail_data,
                    storage_path=storage_path,
                    thumbnail_path=thumbnail_path,
                    file_name=file_name,
                    width=width,
                    height=height,
                    caption=caption,
                    metadata=metadata,
                )

            storage_ok = False
            try:
                logger.info("Uploading photo to %s/%s", self.bucket, storage_path)
                self._upload_to_storage(storage_path, thumbnail_path, compressed)
                storage_ok = True
            except Exception as exc:
                logger.error("Storage upload failed: %s", exc)
                if not self._activate_dev_mode(f"Storage upload failed: {exc}"):
                    raise AxonError(
                        f"Failed to upload photo. Ensure bucket '{self.bucket}' exists.",
                        status_code=503,
                    ) from exc

            if not storage_ok:
                return self._create_dev_photo(
                    user_id,
                    compressed,
                    thumbnail_data,
                    storage_path=storage_path,
                    thumbnail_path=thumbnail_path,
                    file_name=file_name,
                    width=width,
                    height=height,
                    caption=caption,
                    metadata=metadata,
                )

            base_meta = dict(metadata or {})
            base_meta.update(
                {
                    "file_name": file_name,
                    "file_size": len(compressed),
                    "width": width,
                    "height": height,
                }
            )

            photo_data = {
                "user_id": user_id,
                "storage_path": storage_path,
                "thumbnail_path": thumbnail_path,
                "caption": caption,
                "metadata": base_meta,
            }
            extended = {
                "file_name": file_name,
                "file_size": len(compressed),
                "width": width,
                "height": height,
            }

            try:
                result = self.db.table("photos").insert({**photo_data, **extended}).execute()
            except Exception as exc:
                if self._is_missing_table(exc) and self._activate_dev_mode("photos table missing."):
                    return self._create_dev_photo(
                        user_id,
                        compressed,
                        thumbnail_data,
                        storage_path=storage_path,
                        thumbnail_path=thumbnail_path,
                        file_name=file_name,
                        width=width,
                        height=height,
                        caption=caption,
                        metadata=metadata,
                    )
                logger.warning("Extended photo insert failed (%s); retrying base schema.", exc)
                try:
                    result = self.db.table("photos").insert(photo_data).execute()
                except Exception as inner_exc:
                    if self._is_missing_table(inner_exc) and self._activate_dev_mode(
                        "photos table missing."
                    ):
                        return self._create_dev_photo(
                            user_id,
                            compressed,
                            thumbnail_data,
                            storage_path=storage_path,
                            thumbnail_path=thumbnail_path,
                            file_name=file_name,
                            width=width,
                            height=height,
                            caption=caption,
                            metadata=metadata,
                        )
                    raise

            if not result.data:
                raise AxonError("Failed to create photo record", status_code=500)

            logger.info("Created photo record: %s", result.data[0]["id"])
            return self.enrich_photo(result.data[0])

        except AxonError:
            raise
        except Exception as exc:
            if self._is_missing_table(exc) and self._activate_dev_mode("photos table missing."):
                compressed, width, height = self._compress_image(image_data)
                thumbnail_data = self._generate_thumbnail(compressed)
                storage_path, thumbnail_path, file_name = self._build_storage_paths(
                    user_id, filename
                )
                return self._create_dev_photo(
                    user_id,
                    compressed,
                    thumbnail_data,
                    storage_path=storage_path,
                    thumbnail_path=thumbnail_path,
                    file_name=file_name,
                    width=width,
                    height=height,
                    caption=caption,
                    metadata=metadata,
                )
            logger.error("Failed to create photo: %s", exc)
            raise AxonError("Failed to create photo", status_code=500) from exc

    async def list_photos(
        self,
        user_id: str,
        page: int = 1,
        page_size: int = 20,
    ) -> dict:
        if self._dev_mode:
            return self._list_dev_photos(user_id, page, page_size)

        try:
            count_result = (
                self.db.table("photos")
                .select("*", count="exact")
                .eq("user_id", user_id)
                .is_("deleted_at", "null")
                .execute()
            )
            total = count_result.count or 0

            offset = (page - 1) * page_size
            photos_result = (
                self.db.table("photos")
                .select("*")
                .eq("user_id", user_id)
                .is_("deleted_at", "null")
                .order("created_at", desc=True)
                .range(offset, offset + page_size - 1)
                .execute()
            )

            photos = [self.enrich_photo(photo) for photo in (photos_result.data or [])]
            has_more = total > (page * page_size)

            return {
                "photos": photos,
                "total": total,
                "page": page,
                "page_size": page_size,
                "has_more": has_more,
            }
        except Exception as exc:
            if self._is_missing_table(exc) and self._activate_dev_mode("photos table missing."):
                return self._list_dev_photos(user_id, page, page_size)
            logger.error("Failed to list photos: %s", exc)
            raise AxonError("Failed to list photos", status_code=500) from exc

    async def get_photo(self, photo_id: str, user_id: str) -> dict:
        if self._dev_mode:
            photo = self._get_dev_photo(photo_id, user_id)
            if not photo:
                raise AxonError("Photo not found", status_code=404)
            return self._enrich_dev_photo(photo)

        try:
            result = (
                self.db.table("photos")
                .select("*")
                .eq("id", photo_id)
                .eq("user_id", user_id)
                .is_("deleted_at", "null")
                .maybe_single()
                .execute()
            )

            if not result.data:
                raise AxonError("Photo not found", status_code=404)

            return self.enrich_photo(result.data)

        except AxonError:
            raise
        except Exception as exc:
            if self._is_missing_table(exc) and self._activate_dev_mode("photos table missing."):
                photo = self._get_dev_photo(photo_id, user_id)
                if not photo:
                    raise AxonError("Photo not found", status_code=404) from exc
                return self._enrich_dev_photo(photo)
            logger.error("Failed to get photo %s: %s", photo_id, exc)
            raise AxonError("Failed to get photo", status_code=500) from exc

    async def delete_photo(self, photo_id: str, user_id: str) -> dict:
        if self._dev_mode:
            photo = self._get_dev_photo(photo_id, user_id)
            if not photo:
                raise AxonError("Photo not found", status_code=404)
            photo["deleted_at"] = datetime.utcnow().isoformat() + "Z"
            return self._enrich_dev_photo(photo)

        try:
            photo = await self.get_photo(photo_id, user_id)

            result = (
                self.db.table("photos")
                .update({"deleted_at": datetime.utcnow().isoformat()})
                .eq("id", photo_id)
                .execute()
            )

            if not result.data:
                raise AxonError("Failed to delete photo", status_code=500)

            for path in (photo.get("storage_path"), photo.get("thumbnail_path")):
                if not path or photo.get("_dev_image_url"):
                    continue
                try:
                    self.storage.from_(self.bucket).remove([path])
                except Exception as exc:
                    logger.warning("Failed to remove storage object %s: %s", path, exc)

            logger.info("Deleted photo: %s", photo_id)
            return result.data[0]

        except AxonError:
            raise
        except Exception as exc:
            logger.error("Failed to delete photo %s: %s", photo_id, exc)
            raise AxonError("Failed to delete photo", status_code=500) from exc

    async def create_share_url(self, photo_id: str, user_id: str) -> dict:
        try:
            photo = await self.get_photo(photo_id, user_id)
            expires_at = datetime.utcnow() + timedelta(minutes=self.SHARE_URL_EXPIRY_MINUTES)

            if photo.get("image_url"):
                return {
                    "photo_id": photo_id,
                    "share_url": photo["image_url"],
                    "expires_at": expires_at,
                }

            expiry_seconds = self.SHARE_URL_EXPIRY_MINUTES * 60
            share_url = self._create_signed_url(photo["storage_path"], expiry_seconds)

            return {
                "photo_id": photo_id,
                "share_url": share_url,
                "expires_at": expires_at,
            }
        except AxonError:
            raise
        except Exception as exc:
            logger.error("Failed to create share URL for photo %s: %s", photo_id, exc)
            raise AxonError("Failed to create share URL", status_code=500) from exc

    async def list_photos_for_session(
        self,
        user_id: str,
        page: int = 1,
        page_size: int = 50,
    ) -> dict:
        return await self.list_photos(user_id, page, page_size)
