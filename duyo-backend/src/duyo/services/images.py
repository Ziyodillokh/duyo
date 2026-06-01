"""Image search via the Openverse API (Creative Commons).

Used by the chat "Ha → internetdan qidir" flow to attach a few illustrative
images to a web-search answer. Openverse is free and key-less; we request
`mature=false` so only family-safe results reach a child. Any failure returns
an empty list — images are a nice-to-have and must never break the reply.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

import httpx
import structlog

log = structlog.get_logger(__name__)

_OPENVERSE_URL = "https://api.openverse.org/v1/images/"
_TIMEOUT = 6.0
_DEFAULT_LIMIT = 3
_MAX_LIMIT = 5
# Openverse matches all query tokens (AND), so a full question like "fotosintez
# nima" or "...qachon boshlandi" returns nothing. Strip Uzbek question/stop
# words, then progressively drop trailing words until results appear.
_MAX_ATTEMPTS = 4
_STOP_WORDS = frozenset({
    "nima", "nimalar", "qanday", "qanaqa", "qachon", "nega", "nimaga",
    "kim", "kimlar", "qaysi", "qayer", "qayerda", "qayerga", "necha",
    "nechta", "qancha", "bormi", "haqida", "togrisida", "to'g'risida",
    "va", "yoki", "bu", "shu", "uchun",
})


def _keywordize(query: str) -> list[str]:
    """Lowercase, drop punctuation and Uzbek question/stop words → token list."""
    tokens = re.findall(r"[\w']+", query.lower())
    kept = [t for t in tokens if t not in _STOP_WORDS]
    return kept or tokens


@dataclass(frozen=True)
class ImageResult:
    """One illustrative image for a chat answer."""
    url: str            # display URL (Openverse-proxied thumbnail — reliable)
    title: str
    source_url: str     # page to open for attribution / more context
    creator: str | None
    license: str | None


async def _fetch(client: httpx.AsyncClient, q: str, page_size: int) -> list[ImageResult]:
    """One Openverse query → image results. Never raises (returns [] on error)."""
    try:
        resp = await client.get(
            _OPENVERSE_URL,
            params={"q": q, "page_size": str(page_size), "mature": "false"},
            headers={"User-Agent": "DUYO/1.0 (kids education app)"},
        )
        resp.raise_for_status()
        data = resp.json()
    except (httpx.HTTPError, ValueError) as exc:
        log.warning("image_search_failed", error=str(exc), query=q[:60])
        return []

    results: list[ImageResult] = []
    for item in (data.get("results") or [])[:page_size]:
        # Prefer the Openverse-proxied thumbnail (hotlink-safe) over the raw url.
        display = item.get("thumbnail") or item.get("url")
        if not display:
            continue
        results.append(
            ImageResult(
                url=display,
                title=item.get("title") or q,
                source_url=item.get("foreign_landing_url") or display,
                creator=item.get("creator"),
                license=item.get("license"),
            )
        )
    return results


async def search_images(query: str, *, limit: int = _DEFAULT_LIMIT) -> list[ImageResult]:
    """Return up to ``limit`` family-safe images for ``query``.

    Extracts keywords from a (possibly full-sentence) question, then tries
    progressively shorter token windows — Openverse needs concise keywords, so
    "Ikkinchi jahon urushi qachon boshlandi" only matches once trimmed to
    "Ikkinchi jahon urushi". Never raises: returns [] on any failure.
    """
    if not (query or "").strip():
        return []
    page_size = max(1, min(limit, _MAX_LIMIT))
    tokens = _keywordize(query)

    # Candidate queries: full keyword phrase, then drop trailing words. De-dup
    # while preserving order; cap the number of network attempts.
    candidates: list[str] = []
    for end in range(len(tokens), 0, -1):
        cand = " ".join(tokens[:end])
        if cand and cand not in candidates:
            candidates.append(cand)
    candidates = candidates[:_MAX_ATTEMPTS]

    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        for cand in candidates:
            results = await _fetch(client, cand, page_size)
            if results:
                return results
    return []
