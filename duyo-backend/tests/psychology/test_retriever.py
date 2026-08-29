"""Tests for the psychology retriever — build_*_context and retrieve_for_*.

All external calls (Gemini gate, embedding API, DB) are mocked.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from duyo.psychology.retriever import build_chat_context, retrieve_for_chat

# ---------------------------------------------------------------------------
# build_chat_context — pure function
# ---------------------------------------------------------------------------


def _make_chunk(title: str = "Bezovtalik va tashvish", text: str = "Bolalar bezovtalik his qilishi tabiiy.") -> MagicMock:
    chunk = MagicMock()
    chunk.title = title
    chunk.text = text
    return chunk


class TestBuildChatContext:
    def test_returns_none_for_empty_list(self) -> None:
        assert build_chat_context([]) is None

    def test_contains_markers_and_title_and_text(self) -> None:
        chunk = _make_chunk()
        result = build_chat_context([(chunk, 0.7)])
        assert result is not None
        assert "[PSIXOLOGIK KONTEKST]" in result
        assert "[/PSIXOLOGIK KONTEKST]" in result
        assert "Bezovtalik va tashvish" in result
        assert "Bolalar bezovtalik his qilishi tabiiy." in result

    def test_never_says_bilim_bazasi_instruction_present(self) -> None:
        # The instruction block must tell the model not to reveal the source.
        result = build_chat_context([(_make_chunk(), 0.7)])
        assert result is not None
        assert "bilim bazasi" in result.lower()


# ---------------------------------------------------------------------------
# retrieve_for_chat — gate + search + context assembly
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_retrieve_for_chat_returns_none_when_gate_rejects():
    with patch("duyo.psychology.retriever._gate_query", AsyncMock(return_value="")):
        result = await retrieve_for_chat(AsyncMock(), "salom, bugun ob-havo yaxshi")
    assert result is None


@pytest.mark.asyncio
async def test_retrieve_for_chat_returns_none_when_no_results():
    with (
        patch("duyo.psychology.retriever._gate_query", AsyncMock(return_value="bezovtalik")),
        patch("duyo.psychology.retriever.search_topics", AsyncMock(return_value=[])),
    ):
        result = await retrieve_for_chat(AsyncMock(), "juda bezovtaman")
    assert result is None


@pytest.mark.asyncio
async def test_retrieve_for_chat_returns_context_on_hit():
    chunk = _make_chunk(title="Bezovtalik va tashvish")
    with (
        patch("duyo.psychology.retriever._gate_query", AsyncMock(return_value="bezovtalik")),
        patch("duyo.psychology.retriever.search_topics", AsyncMock(return_value=[(chunk, 0.8)])),
    ):
        result = await retrieve_for_chat(AsyncMock(), "juda bezovtaman", age_segment="explorer")
    assert result is not None
    assert "Bezovtalik va tashvish" in result.context
    assert result.topic_titles == ["Bezovtalik va tashvish"]
