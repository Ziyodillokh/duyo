from types import SimpleNamespace

import pytest

from duyo.models.child import AgeSegment
from duyo.services.gemini import WebSource, _extract_web_sources


def _resp(chunks, text=""):
    web_chunks = [SimpleNamespace(web=SimpleNamespace(**c)) for c in chunks]
    cand = SimpleNamespace(grounding_metadata=SimpleNamespace(grounding_chunks=web_chunks))
    return SimpleNamespace(candidates=[cand], text=text, usage_metadata=None)


def test_extract_web_sources_parses_and_dedups():
    resp = _resp([
        {"uri": "https://a.uz", "title": "A"},
        {"uri": "https://a.uz", "title": "A dup"},
        {"uri": "https://b.uz", "title": "B"},
    ])
    sources = _extract_web_sources(resp)
    assert sources == (WebSource("A", "https://a.uz"), WebSource("B", "https://b.uz"))


def test_extract_web_sources_tolerates_missing_metadata():
    assert _extract_web_sources(SimpleNamespace(candidates=[])) == ()
    assert _extract_web_sources(SimpleNamespace()) == ()


@pytest.mark.asyncio
async def test_chat_with_web_search_returns_text_and_sources(monkeypatch):
    captured = {}

    class _FakeModels:
        async def generate_content(self, **kwargs):
            captured["config"] = kwargs["config"]
            return _resp([{"uri": "https://wikipedia.org", "title": "Wiki"}], text="javob")

    class _FakeClient:
        aio = SimpleNamespace(models=_FakeModels())

    monkeypatch.setattr("duyo.services.gemini.get_client", lambda: _FakeClient())

    from duyo.services import gemini
    reply = await gemini.chat_with_web_search(
        child_message="sitoplazma nima", age_segment=AgeSegment.EXPLORER,
    )
    assert reply.text == "javob"
    assert reply.sources[0].url == "https://wikipedia.org"
    assert captured["config"].tools, "expected google_search tool attached"
