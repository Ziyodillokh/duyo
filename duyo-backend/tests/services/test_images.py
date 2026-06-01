import httpx
import pytest

from duyo.services import images as img


class _FakeResp:
    def __init__(self, payload):
        self._payload = payload

    def raise_for_status(self):
        return None

    def json(self):
        return self._payload


class _FakeClient:
    """Stands in for httpx.AsyncClient as an async context manager."""

    def __init__(self, payload=None, exc=None, captured=None):
        self._payload = payload
        self._exc = exc
        self._captured = captured if captured is not None else {}

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_a):
        return False

    async def get(self, url, params=None, **_kw):
        self._captured["url"] = url
        self._captured["params"] = params
        if self._exc:
            raise self._exc
        return _FakeResp(self._payload)


_OPENVERSE_PAYLOAD = {
    "results": [
        {
            "title": "Photosynthesis",
            "thumbnail": "https://api.openverse.org/thumb/1.jpg",
            "url": "https://example.org/raw1.jpg",
            "foreign_landing_url": "https://commons.wikimedia.org/1",
            "creator": "Alice",
            "license": "cc-by",
        },
        {
            "title": "Leaf",
            "thumbnail": "https://api.openverse.org/thumb/2.jpg",
            "url": "https://example.org/raw2.jpg",
            "foreign_landing_url": "https://commons.wikimedia.org/2",
            "creator": None,
            "license": "pdm",
        },
    ]
}


@pytest.mark.asyncio
async def test_search_images_parses_results_and_prefers_thumbnail(monkeypatch):
    captured = {}
    monkeypatch.setattr(
        img.httpx, "AsyncClient",
        lambda *_a, **_k: _FakeClient(payload=_OPENVERSE_PAYLOAD, captured=captured),
    )
    results = await img.search_images("fotosintez", limit=3)

    assert len(results) == 2
    assert results[0].url == "https://api.openverse.org/thumb/1.jpg"  # thumbnail preferred
    assert results[0].source_url == "https://commons.wikimedia.org/1"
    assert results[0].creator == "Alice"
    # Child-safe: mature filter must always be off.
    assert captured["params"]["mature"] == "false"


@pytest.mark.asyncio
async def test_search_images_returns_empty_on_http_error(monkeypatch):
    monkeypatch.setattr(
        img.httpx, "AsyncClient",
        lambda *_a, **_k: _FakeClient(exc=httpx.ConnectError("boom")),
    )
    assert await img.search_images("anything") == []


@pytest.mark.asyncio
async def test_search_images_empty_query_skips_call():
    assert await img.search_images("   ") == []


@pytest.mark.asyncio
async def test_search_images_skips_items_without_image(monkeypatch):
    payload = {"results": [{"title": "no image", "foreign_landing_url": "x"}]}
    monkeypatch.setattr(
        img.httpx, "AsyncClient",
        lambda *_a, **_k: _FakeClient(payload=payload),
    )
    assert await img.search_images("q") == []
