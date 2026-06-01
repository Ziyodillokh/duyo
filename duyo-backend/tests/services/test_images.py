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
    """httpx.AsyncClient stand-in. `responder(q) -> payload` lets a test vary
    results by query (for the progressive-fallback path)."""

    def __init__(self, responder=None, exc=None, calls=None):
        self._responder = responder
        self._exc = exc
        self._calls = calls if calls is not None else []

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_a):
        return False

    async def get(self, _url, params=None, **_kw):
        self._calls.append(params)
        if self._exc:
            raise self._exc
        payload = self._responder(params["q"]) if self._responder else {"results": []}
        return _FakeResp(payload)


def _two_images(_q):
    return {
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


def _patch(monkeypatch, responder=None, exc=None, calls=None):
    monkeypatch.setattr(
        img.httpx, "AsyncClient",
        lambda *_a, **_k: _FakeClient(responder=responder, exc=exc, calls=calls),
    )


def test_keywordize_strips_question_words():
    assert img._keywordize("fotosintez nima?") == ["fotosintez"]
    assert img._keywordize("Ikkinchi jahon urushi qachon boshlandi") == [
        "ikkinchi", "jahon", "urushi", "boshlandi",
    ]
    # All stop words → falls back to the raw tokens (never empty).
    assert img._keywordize("nima qanday") == ["nima", "qanday"]


@pytest.mark.asyncio
async def test_search_images_parses_results_and_prefers_thumbnail(monkeypatch):
    calls = []
    _patch(monkeypatch, responder=_two_images, calls=calls)
    results = await img.search_images("fotosintez", limit=3)

    assert len(results) == 2
    assert results[0].url == "https://api.openverse.org/thumb/1.jpg"  # thumbnail preferred
    assert results[0].source_url == "https://commons.wikimedia.org/1"
    assert results[0].creator == "Alice"
    assert calls[0]["mature"] == "false"  # child-safe filter always on


@pytest.mark.asyncio
async def test_search_images_progressive_fallback(monkeypatch):
    # Only the trimmed keyword phrase matches — full sentence returns nothing.
    def responder(q):
        return _two_images(q) if q == "ikkinchi jahon urushi" else {"results": []}

    calls = []
    _patch(monkeypatch, responder=responder, calls=calls)
    results = await img.search_images("Ikkinchi jahon urushi qachon boshlandi")

    assert len(results) == 2
    tried = [c["q"] for c in calls]
    assert "ikkinchi jahon urushi boshlandi" in tried  # full keyword phrase first
    assert "ikkinchi jahon urushi" in tried            # then trimmed → match


@pytest.mark.asyncio
async def test_search_images_returns_empty_on_http_error(monkeypatch):
    _patch(monkeypatch, exc=httpx.ConnectError("boom"))
    assert await img.search_images("anything") == []


@pytest.mark.asyncio
async def test_search_images_empty_query_skips_call():
    assert await img.search_images("   ") == []


@pytest.mark.asyncio
async def test_search_images_skips_items_without_image(monkeypatch):
    _patch(monkeypatch, responder=lambda _q: {"results": [{"title": "no image"}]})
    assert await img.search_images("q") == []
