"""Tests for textbook retriever — search_chunks and build_rag_context.

All external calls (embedding API, DB) are mocked.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from duyo.textbook.retriever import build_rag_context, search_chunks


# ---------------------------------------------------------------------------
# build_rag_context — pure function
# ---------------------------------------------------------------------------

def _make_db_chunk(
    subject: str = "matematika",
    grade: int = 6,
    topic: str | None = "Kasrlar",
    content_type: str = "rule",
    text: str = "Qoida: kasrlarni qo'shish uchun suratlari qo'shiladi.",
) -> MagicMock:
    chunk = MagicMock()
    chunk.subject = subject
    chunk.grade = grade
    chunk.topic = topic
    chunk.topic_id = "math_6_fractions_add_same"
    chunk.content_type = content_type
    chunk.text = text
    chunk.difficulty = "easy"
    chunk.has_formula = False
    chunk.source_path = "textbooks/matematika-6.txt"
    return chunk


class TestBuildRagContext:
    def test_returns_none_for_empty_list(self) -> None:
        assert build_rag_context([]) is None

    def test_contains_darslik_kontekst_marker(self) -> None:
        chunk = _make_db_chunk()
        result = build_rag_context([(chunk, 0.92)])
        assert result is not None
        assert "[DARSLIK KONTEKST]" in result
        assert "[/DARSLIK KONTEKST]" in result

    def test_contains_chunk_text(self) -> None:
        chunk = _make_db_chunk(text="Qoida: suratlari qo'shiladi.")
        result = build_rag_context([(chunk, 0.90)])
        assert result is not None
        assert "Qoida: suratlari qo'shiladi." in result

    def test_contains_subject_and_grade(self) -> None:
        chunk = _make_db_chunk(subject="fizika", grade=9)
        result = build_rag_context([(chunk, 0.85)])
        assert result is not None
        assert "fizika" in result
        assert "9" in result

    def test_contains_topic(self) -> None:
        chunk = _make_db_chunk(topic="Elektr toki")
        result = build_rag_context([(chunk, 0.88)])
        assert result is not None
        assert "Elektr toki" in result

    def test_no_topic_still_works(self) -> None:
        chunk = _make_db_chunk(topic=None)
        result = build_rag_context([(chunk, 0.80)])
        assert result is not None
        assert "[DARSLIK KONTEKST]" in result

    def test_multiple_chunks_all_included(self) -> None:
        c1 = _make_db_chunk(text="Birinchi qoida.")
        c2 = _make_db_chunk(text="Ikkinchi ta'rif.")
        result = build_rag_context([(c1, 0.95), (c2, 0.85)])
        assert result is not None
        assert "Birinchi qoida." in result
        assert "Ikkinchi ta'rif." in result

    def test_contains_instruction_to_use_context(self) -> None:
        chunk = _make_db_chunk()
        result = build_rag_context([(chunk, 0.90)])
        assert result is not None
        assert "darslik" in result.lower()

    def test_truncates_very_long_chunk(self) -> None:
        long_text = "A" * 3000
        chunk = _make_db_chunk(text=long_text)
        result = build_rag_context([(chunk, 0.90)])
        assert result is not None
        # Should be truncated with ellipsis
        assert "…" in result


# ---------------------------------------------------------------------------
# search_chunks — mocked embed + DB
# ---------------------------------------------------------------------------

class TestSearchChunks:
    @pytest.mark.asyncio
    async def test_returns_empty_on_embed_failure(self) -> None:
        session = AsyncMock()

        with patch(
            "duyo.textbook.retriever.emb_service.embed_query",
            new_callable=AsyncMock,
            side_effect=RuntimeError("API unavailable"),
        ):
            results = await search_chunks(session, "kasrlarni qo'shish")

        assert results == []

    @pytest.mark.asyncio
    async def test_returns_empty_on_search_failure(self) -> None:
        session = AsyncMock()

        with patch(
            "duyo.textbook.retriever.emb_service.embed_query",
            new_callable=AsyncMock,
            return_value=[0.1] * 768,
        ), patch(
            "duyo.textbook.retriever.chunk_store.search",
            new_callable=AsyncMock,
            side_effect=Exception("DB error"),
        ):
            results = await search_chunks(session, "kasrlarni qo'shish")

        assert results == []

    @pytest.mark.asyncio
    async def test_returns_chunks_with_scores(self) -> None:
        session = AsyncMock()
        mock_chunks = [_make_db_chunk(), _make_db_chunk(text="Ikkinchi chunk.")]

        with patch(
            "duyo.textbook.retriever.emb_service.embed_query",
            new_callable=AsyncMock,
            return_value=[0.1] * 768,
        ), patch(
            "duyo.textbook.retriever.chunk_store.search",
            new_callable=AsyncMock,
            return_value=mock_chunks,
        ):
            results = await search_chunks(session, "kasrlar")

        assert len(results) == 2
        # Each result is (chunk, score) tuple
        for chunk, score in results:
            assert hasattr(chunk, "text")
            assert 0.0 <= score <= 1.0

    @pytest.mark.asyncio
    async def test_scores_decrease_by_rank(self) -> None:
        session = AsyncMock()
        mock_chunks = [_make_db_chunk(), _make_db_chunk(), _make_db_chunk()]

        with patch(
            "duyo.textbook.retriever.emb_service.embed_query",
            new_callable=AsyncMock,
            return_value=[0.1] * 768,
        ), patch(
            "duyo.textbook.retriever.chunk_store.search",
            new_callable=AsyncMock,
            return_value=mock_chunks,
        ):
            results = await search_chunks(session, "kasrlar", limit=3)

        scores = [score for _, score in results]
        # First result should have highest similarity
        assert scores[0] >= scores[-1]

    @pytest.mark.asyncio
    async def test_filters_passed_to_store(self) -> None:
        session = AsyncMock()

        with patch(
            "duyo.textbook.retriever.emb_service.embed_query",
            new_callable=AsyncMock,
            return_value=[0.1] * 768,
        ) as mock_embed, patch(
            "duyo.textbook.retriever.chunk_store.search",
            new_callable=AsyncMock,
            return_value=[],
        ) as mock_search:
            await search_chunks(
                session, "query", subject="matematika", grade=6, limit=3
            )

        mock_search.assert_called_once_with(
            session,
            [0.1] * 768,
            subject="matematika",
            grade=6,
            content_type=None,
            topic_id=None,
            limit=3,
        )

    @pytest.mark.asyncio
    async def test_empty_result_from_store(self) -> None:
        session = AsyncMock()

        with patch(
            "duyo.textbook.retriever.emb_service.embed_query",
            new_callable=AsyncMock,
            return_value=[0.1] * 768,
        ), patch(
            "duyo.textbook.retriever.chunk_store.search",
            new_callable=AsyncMock,
            return_value=[],
        ):
            results = await search_chunks(session, "nothing here")

        assert results == []


# ---------------------------------------------------------------------------
# retrieve_for_chat — integration of search + context building
# ---------------------------------------------------------------------------

class TestRetrieveForChat:
    @pytest.mark.asyncio
    async def test_returns_none_when_no_chunks(self) -> None:
        from duyo.textbook.retriever import retrieve_for_chat

        session = AsyncMock()

        with patch(
            "duyo.textbook.retriever.emb_service.embed_query",
            new_callable=AsyncMock,
            return_value=[0.1] * 768,
        ), patch(
            "duyo.textbook.retriever.chunk_store.search",
            new_callable=AsyncMock,
            return_value=[],
        ):
            result = await retrieve_for_chat(session, "kasrlar nima?", grade=6)

        assert result is None

    @pytest.mark.asyncio
    async def test_returns_context_string_when_chunks_found(self) -> None:
        from duyo.textbook.retriever import retrieve_for_chat

        session = AsyncMock()
        mock_chunk = _make_db_chunk(text="Kasrlar — bu sonlarni ifodalash usuli.")

        with patch(
            "duyo.textbook.retriever.emb_service.embed_query",
            new_callable=AsyncMock,
            return_value=[0.1] * 768,
        ), patch(
            "duyo.textbook.retriever.chunk_store.search",
            new_callable=AsyncMock,
            return_value=[(mock_chunk, 0.88)],
        ):
            result = await retrieve_for_chat(session, "kasrlar nima?", grade=6)

        assert result is not None
        assert "[DARSLIK KONTEKST]" in result
        assert "Kasrlar" in result
