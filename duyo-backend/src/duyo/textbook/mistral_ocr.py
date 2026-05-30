"""Mistral OCR service for scanned PDFs, Uzbek Cyrillic, and complex formulas.

Uses Mistral's `mistral-ocr-latest` model via the REST API.
httpx is already a core dependency — no new package needed.

Output: per-page markdown strings, then fed into _parse_from_markdown().

Pricing (2026): ~$0.001/page.
5 darslik × 200 bet = 1 000 bet × $0.001 = $1 ≈ juda arzon.

Mistral OCR output format:
  - Headings: # ## ###
  - Tables: markdown pipe tables
  - Formulas: $inline$ and $$block$$   (LaTeX)
  - Images: ![description](image_N.png) placeholders
  - Cyrillic / Latin / Arabic: full Unicode support
"""

from __future__ import annotations

import base64
import logging
from pathlib import Path

import httpx

from duyo.core.config import get_settings

log = logging.getLogger(__name__)

_MISTRAL_OCR_URL = "https://api.mistral.ai/v1/ocr"
_TIMEOUT_SECONDS = 180.0  # large PDFs can take a while


def _encode_pdf(path: Path) -> str:
    """Base64-encode a PDF file for inline upload."""
    raw = path.read_bytes()
    b64 = base64.standard_b64encode(raw).decode("ascii")
    return f"data:application/pdf;base64,{b64}"


async def ocr_pdf(
    path: Path,
    *,
    api_key: str | None = None,
    model: str | None = None,
) -> list[str]:
    """Run Mistral OCR on a PDF file.

    Returns a list of per-page markdown strings (one entry per page).
    Raises httpx.HTTPStatusError on API errors.
    Raises RuntimeError if MISTRAL_API_KEY is not configured.
    """
    settings = get_settings()
    key = api_key or settings.mistral_api_key
    if not key:
        raise RuntimeError(
            "MISTRAL_API_KEY is not set. "
            "Add it to .env: MISTRAL_API_KEY=your_key_here"
        )
    ocr_model = model or settings.mistral_ocr_model

    log.info("mistral_ocr_start", path=str(path), model=ocr_model)

    document_url = _encode_pdf(path)

    async with httpx.AsyncClient(timeout=_TIMEOUT_SECONDS) as client:
        resp = await client.post(
            _MISTRAL_OCR_URL,
            headers={
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json",
            },
            json={
                "model": ocr_model,
                "document": {
                    "type": "document_url",
                    "document_url": document_url,
                },
                "include_image_base64": False,
            },
        )
        resp.raise_for_status()

    data = resp.json()
    pages: list[dict] = data.get("pages", [])
    usage = data.get("usage_info", {})

    log.info(
        "mistral_ocr_done",
        path=str(path),
        pages=len(pages),
        pages_processed=usage.get("pages_processed", len(pages)),
    )

    return [page.get("markdown", "") for page in pages]


async def ocr_pdf_as_markdown(
    path: Path,
    *,
    api_key: str | None = None,
    model: str | None = None,
) -> str:
    """Run Mistral OCR and return all pages joined as a single markdown string.

    Pages are separated by `---` (thematic break) so the downstream parser
    can optionally detect page boundaries.
    """
    pages = await ocr_pdf(path, api_key=api_key, model=model)
    return "\n\n---\n\n".join(p.strip() for p in pages if p.strip())
