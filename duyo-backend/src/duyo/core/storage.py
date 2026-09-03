"""Object storage for uploaded media (MinIO/S3).

Content cover images, PDFs and audio are uploaded here and served back through
the API (GET /v1/content/media/{key}) so the bucket stays private and the app
only ever sees stable api.duyo.uz URLs.
"""

from __future__ import annotations

import io
from functools import lru_cache
from uuid import uuid4

from minio import Minio
from minio.error import S3Error

from duyo.core.config import get_settings

# Allowed upload kinds → (mime allowlist, max bytes, extension).
IMAGE_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}
PDF_TYPES = {"application/pdf": ".pdf"}
AUDIO_TYPES = {
    "audio/mpeg": ".mp3",
    "audio/mp4": ".m4a",
    "audio/wav": ".wav",
    "audio/ogg": ".ogg",
    # What a browser's MediaRecorder actually produces — a chat voice note
    # recorded on the web arrives as webm/opus and nothing else.
    "audio/webm": ".webm",
}
#: Short video notes from the chat composer. Deliberately small: these are
#: seconds-long clips, not uploads of a film.
VIDEO_TYPES = {
    "video/webm": ".webm",
    "video/mp4": ".mp4",
    "video/quicktime": ".mov",
}

MAX_IMAGE_BYTES = 5 * 1024 * 1024    # 5 MB
MAX_PDF_BYTES = 25 * 1024 * 1024     # 25 MB
MAX_AUDIO_BYTES = 20 * 1024 * 1024   # 20 MB
MAX_VIDEO_BYTES = 40 * 1024 * 1024   # 40 MB


class UploadError(ValueError):
    """Raised for an unsupported content type or oversized upload."""


@lru_cache
def _client() -> Minio:
    s = get_settings()
    return Minio(
        s.minio_endpoint,
        access_key=s.minio_access_key,
        secret_key=s.minio_secret_key,
        secure=s.minio_secure,
    )


def _ensure_bucket(client: Minio, bucket: str) -> None:
    if not client.bucket_exists(bucket):
        client.make_bucket(bucket)


def normalise_type(content_type: str) -> str:
    """Drop codec parameters and case from a MIME type.

    A browser does not send "audio/webm" — it sends
    "audio/webm;codecs=opus". Matching the raw header against the allowlists
    rejects every voice note recorded on the web, so the parameters come off
    before the lookup.
    """
    return (content_type or "").split(";")[0].strip().lower()


def _validate(content_type: str, size: int) -> str:
    """Return the file extension for an allowed (type, size), else raise."""
    kind = normalise_type(content_type)
    if kind in IMAGE_TYPES:
        if size > MAX_IMAGE_BYTES:
            raise UploadError("Rasm hajmi 5 MB dan oshmasligi kerak")
        return IMAGE_TYPES[kind]
    if kind in PDF_TYPES:
        if size > MAX_PDF_BYTES:
            raise UploadError("PDF hajmi 25 MB dan oshmasligi kerak")
        return PDF_TYPES[kind]
    if kind in AUDIO_TYPES:
        if size > MAX_AUDIO_BYTES:
            raise UploadError("Audio hajmi 20 MB dan oshmasligi kerak")
        return AUDIO_TYPES[kind]
    if kind in VIDEO_TYPES:
        if size > MAX_VIDEO_BYTES:
            raise UploadError("Video hajmi 40 MB dan oshmasligi kerak")
        return VIDEO_TYPES[kind]
    raise UploadError(f"Qo'llab-quvvatlanmaydigan fayl turi: {content_type}")


def upload(data: bytes, content_type: str) -> str:
    """Store bytes and return the object key. Validates type + size."""
    ext = _validate(content_type, len(data))
    client = _client()
    bucket = get_settings().minio_bucket
    _ensure_bucket(client, bucket)
    key = f"{uuid4().hex}{ext}"
    client.put_object(
        bucket,
        key,
        io.BytesIO(data),
        length=len(data),
        # Stored without the codec parameters, so what is served back is a
        # plain type every player understands.
        content_type=normalise_type(content_type),
    )
    return key


def media_url(key: str) -> str:
    """Absolute URL the app/admin use to fetch the object."""
    base = get_settings().public_base_url.rstrip("/")
    return f"{base}/v1/content/media/{key}"


def remove(key: str) -> None:
    """Delete one object. A key that is already gone is not an error.

    Only account deletion calls this. Everywhere else a replaced upload
    deliberately leaves the old object behind (see chat.py's photo upload):
    dropping the previous file before the new one lands is how a child ends
    up with no photo at all. Erasure is the one case where the file has to go.
    """
    client = _client()
    client.remove_object(get_settings().minio_bucket, key)


def get_object(key: str):
    """Return (stream, content_type, size) for serving. Raises S3Error if missing."""
    client = _client()
    bucket = get_settings().minio_bucket
    stat = client.stat_object(bucket, key)
    resp = client.get_object(bucket, key)
    return resp, stat.content_type, stat.size


__all__ = [
    "AUDIO_TYPES",
    "VIDEO_TYPES",
    "S3Error",
    "UploadError",
    "get_object",
    "media_url",
    "normalise_type",
    "remove",
    "upload",
]
