from types import SimpleNamespace

import pytest

from duyo.textbook import retriever


def _chunk(subject, grade, topic, text="matn"):
    return SimpleNamespace(subject=subject, grade=grade, topic=topic, content_type="explanation", text=text)


@pytest.mark.asyncio
async def test_retrieve_for_chat_builds_refs(monkeypatch):
    async def fake_search(_session, _query, **_kw):
        return [(_chunk("botanika", 6, "Hujayra"), 0.7), (_chunk("botanika", 6, "Hujayra"), 0.68)]

    monkeypatch.setattr(retriever, "_normalize_query", lambda q: _async(q))
    monkeypatch.setattr(retriever, "search_chunks", fake_search)

    result = await retriever.retrieve_for_chat(session=None, child_message="vakuol nima")
    assert result is not None
    assert result.refs == [("botanika", 6, "Hujayra")]  # deduped by (subject, grade)
    assert "DARSLIK KONTEKST" in result.context


@pytest.mark.asyncio
async def test_retrieve_for_chat_none_when_no_results(monkeypatch):
    async def fake_search(_session, _query, **_kw):
        return []
    monkeypatch.setattr(retriever, "_normalize_query", lambda q: _async(q))
    monkeypatch.setattr(retriever, "search_chunks", fake_search)
    assert await retriever.retrieve_for_chat(session=None, child_message="qwerty") is None


@pytest.mark.asyncio
async def test_retrieve_for_chat_skips_non_topical(monkeypatch):
    # Normalizer returns NONE for greetings/commands → RAG must be skipped,
    # even though search_chunks would have returned junk.
    called = {"search": False}

    async def fake_search(_session, _query, **_kw):
        called["search"] = True
        return [(_chunk("ona-tili", 6, "Darslikdan foydalanish"), 0.74)]

    monkeypatch.setattr(retriever, "_normalize_query", lambda _q: _async("NONE"))
    monkeypatch.setattr(retriever, "search_chunks", fake_search)

    result = await retriever.retrieve_for_chat(session=None, child_message="darslik bo'yicha javob ber")
    assert result is None
    assert called["search"] is False  # gated before search


@pytest.mark.asyncio
async def test_retrieve_for_chat_keeps_only_dominant_subject(monkeypatch):
    async def fake_search(_session, _query, **_kw):
        return [
            (_chunk("botanika", 6, "Hujayra qismlari"), 0.71),
            (_chunk("tarix", 6, "Geografik nomlar"), 0.69),  # cross-subject noise
        ]

    monkeypatch.setattr(retriever, "_normalize_query", lambda q: _async(q))
    monkeypatch.setattr(retriever, "search_chunks", fake_search)

    result = await retriever.retrieve_for_chat(session=None, child_message="yadro nima")
    assert result is not None
    assert result.refs == [("botanika", 6, "Hujayra qismlari")]  # tarix dropped


async def _async(v):
    return v
