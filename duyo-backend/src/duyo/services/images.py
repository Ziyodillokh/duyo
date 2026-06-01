"""Image search via the Openverse API (Creative Commons).

Used by the chat "Ha → internetdan qidir" flow to attach a few illustrative
images to a web-search answer. Openverse is free and key-less; we request
`mature=false` so only family-safe results reach a child. Any failure returns
an empty list — images are a nice-to-have and must never break the reply.
"""

from __future__ import annotations

from dataclasses import dataclass

import httpx
import structlog

log = structlog.get_logger(__name__)

_OPENVERSE_URL = "https://api.openverse.org/v1/images/"
_TIMEOUT = 8.0
_DEFAULT_LIMIT = 3
_MAX_LIMIT = 5


@dataclass(frozen=True)
class ImageResult:
    """One illustrative image for a chat answer."""
    url: str            # display URL (Openverse-proxied thumbnail — reliable)
    title: str
    source_url: str     # page to open for attribution / more context
    creator: str | None
    license: str | None


async def search_images(query: str, *, limit: int = _DEFAULT_LIMIT) -> list[ImageResult]:
    """Return up to ``limit`` family-safe images for ``query``.

    Never raises: on any network/parse error returns an empty list so the chat
    reply is unaffected.
    """
    query = (query or "").strip()
    if not query:
        return []
    page_size = max(1, min(limit, _MAX_LIMIT))
    params = {
        "q": query,
        "page_size": str(page_size),
        "mature": "false",  # exclude mature content (child-safe)
    }
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.get(
                _OPENVERSE_URL,
                params=params,
                headers={"User-Agent": "DUYO/1.0 (kids education app)"},
            )
            resp.raise_for_status()
            data = resp.json()
    except (httpx.HTTPError, ValueError) as exc:
        log.warning("image_search_failed", error=str(exc), query=query[:60])
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
                title=item.get("title") or query,
                source_url=item.get("foreign_landing_url") or display,
                creator=item.get("creator"),
                license=item.get("license"),
            )
        )
    return results
