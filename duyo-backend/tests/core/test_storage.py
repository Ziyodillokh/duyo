"""Storage upload validation (type + size) — pure, no MinIO connection."""

import pytest

from duyo.core import storage


def test_image_type_returns_extension():
    assert storage._validate("image/png", 1000) == ".png"
    assert storage._validate("image/jpeg", 1000) == ".jpg"


def test_pdf_and_audio_allowed():
    assert storage._validate("application/pdf", 1000) == ".pdf"
    assert storage._validate("audio/mpeg", 1000) == ".mp3"


def test_oversized_image_rejected():
    with pytest.raises(storage.UploadError):
        storage._validate("image/png", storage.MAX_IMAGE_BYTES + 1)


def test_oversized_pdf_rejected():
    with pytest.raises(storage.UploadError):
        storage._validate("application/pdf", storage.MAX_PDF_BYTES + 1)


def test_unknown_type_rejected():
    with pytest.raises(storage.UploadError):
        storage._validate("application/x-msdownload", 100)


def test_media_url_uses_public_base(monkeypatch):
    # media_url should build an absolute api URL from settings.public_base_url
    url = storage.media_url("abc.png")
    assert url.endswith("/v1/content/media/abc.png")
    assert url.startswith("http")
