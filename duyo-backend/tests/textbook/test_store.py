"""Tests for textbook store — upsert, embed_pending, search.

All DB interactions are mocked via AsyncMock so no real PostgreSQL needed.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from duyo.textbook.schema import (
    ChunkMetadata,
    ClassifiedChunk,
    Confidence,
    ContentType,
    Difficulty,
    DocumentMeta,
    Language,
    Script,
)
from duyo.textbook.store import _to_row, doc_is_ingested


# ---------------------------------------------------------------------------
# _to_row — pure function, no DB needed
# ---------------------------------------------------------------------------

def _make_chunk(
    doc_id: str = "abc123",
    chunk_index: int = 0,
    content_type: ContentType = ContentType.DEFINITION,
    has_formula: bool = False,
) -> ClassifiedChunk:
    meta = ChunkMetadata(
        subject="matematika",
        grade=6,
        language=Language.UZ,
        script=Script.LATIN,
        source_path="textbooks/matematika-6.txt",
        topic="Bir xil maxrajli kasrlarni qo'shish",
        topic_id="math_6_fractions_add_same",
        content_type=content_type,
        difficulty=Difficulty.EASY,
        has_formula=has_formula,
        classified_by="rule",
        confidence=Confidence(content_type=0.95, topic=0.88, difficulty=0.75),
    )
    return ClassifiedChunk(text="Ta'rif: kasrlar haqida.", metadata=meta,
                           chunk_index=chunk_index, doc_id=doc_id)


class TestToRow:
    def test_basic_fields(self) -> None:
        chunk = _make_chunk()
        row = _to_row(chunk)
        assert row["subject"] == "matematika"
        assert row["grade"] == 6
        assert row["language"] == "uz"
        assert row["doc_id"] == "abc123"
        assert row["chunk_index"] == 0
        assert row["content_type"] == "definition"
        assert row["difficulty"] == "easy"
        assert row["classified_by"] == "rule"
        assert row["embedding"] is None

    def test_confidence_fields(self) -> None:
        chunk = _make_chunk()
        row = _to_row(chunk)
        assert row["confidence_content_type"] == pytest.approx(0.95)
        assert row["confidence_topic"] == pytest.approx(0.88)
        assert row["confidence_difficulty"] == pytest.approx(0.75)

    def test_formula_flag(self) -> None:
        chunk = _make_chunk(has_formula=True)
        row = _to_row(chunk)
        assert row["has_formula"] is True

    def test_text_preserved(self) -> None:
        chunk = _make_chunk()
        row = _to_row(chunk)
        assert row["text"] == "Ta'rif: kasrlar haqida."

    def test_topic_id_preserved(self) -> None:
        chunk = _make_chunk()
        row = _to_row(chunk)
        assert row["topic_id"] == "math_6_fractions_add_same"


# ---------------------------------------------------------------------------
# upsert_chunks — mocked session
# ---------------------------------------------------------------------------

class TestUpsertChunks:
    @pytest.mark.asyncio
    async def test_empty_list_returns_zero(self) -> None:
        from duyo.textbook.store import upsert_chunks

        session = AsyncMock()
        result = await upsert_chunks(session, [])
        assert result == 0
        session.execute.assert_not_called()

    @pytest.mark.asyncio
    async def test_calls_execute_with_chunks(self) -> None:
        from duyo.textbook.store import upsert_chunks

        chunks = [_make_chunk("d1", 0), _make_chunk("d1", 1)]
        session = AsyncMock()
        mock_result = MagicMock()
        mock_result.rowcount = 2
        session.execute.return_value = mock_result

        count = await upsert_chunks(session, chunks)

        assert count == 2
        session.execute.assert_called_once()
        session.flush.assert_called_once()

    @pytest.mark.asyncio
    async def test_single_chunk(self) -> None:
        from duyo.textbook.store import upsert_chunks

        session = AsyncMock()
        mock_result = MagicMock()
        mock_result.rowcount = 1
        session.execute.return_value = mock_result

        count = await upsert_chunks(session, [_make_chunk()])
        assert count == 1


# ---------------------------------------------------------------------------
# embed_pending — mocked session + embedding service
# ---------------------------------------------------------------------------

class TestEmbedPending:
    def _make_db_row(self, chunk_id=None) -> MagicMock:
        row = MagicMock()
        row.id = chunk_id or uuid4()
        row.text = "Ta'rif: kasrlar haqida bilim."
        row.doc_id = "abc123"
        return row

    @pytest.mark.asyncio
    async def test_no_pending_returns_zero(self) -> None:
        from duyo.textbook.store import embed_pending

        session = AsyncMock()
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = []
        mock_result = MagicMock()
        mock_result.scalars.return_value = mock_scalars
        session.execute.return_value = mock_result

        count = await embed_pending(session)
        assert count == 0

    @pytest.mark.asyncio
    async def test_embeds_pending_chunks(self) -> None:
        from duyo.textbook.store import embed_pending

        rows = [self._make_db_row(), self._make_db_row()]
        session = AsyncMock()
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = rows
        mock_result = MagicMock()
        mock_result.scalars.return_value = mock_scalars
        session.execute.return_value = mock_result

        fake_vectors = [[0.1] * 768, [0.2] * 768]

        with patch(
            "duyo.textbook.store.emb_service.embed_documents",
            new_callable=AsyncMock,
            return_value=fake_vectors,
        ):
            count = await embed_pending(session, batch_size=10)

        assert count == 2
        session.flush.assert_called_once()


# ---------------------------------------------------------------------------
# doc_is_ingested — resume support
# ---------------------------------------------------------------------------

class TestDocIsIngested:
    @pytest.mark.asyncio
    async def test_returns_false_when_no_chunks(self) -> None:
        session = AsyncMock()
        session.scalar.return_value = 0  # total count = 0
        assert await doc_is_ingested(session, "abc123") is False

    @pytest.mark.asyncio
    async def test_returns_true_when_all_embedded(self) -> None:
        session = AsyncMock()
        # 1st scalar() = total (5), 2nd = missing embeddings (0)
        session.scalar.side_effect = [5, 0]
        assert await doc_is_ingested(session, "abc123") is True

    @pytest.mark.asyncio
    async def test_returns_false_when_partially_embedded(self) -> None:
        session = AsyncMock()
        # total=5, missing=2 → half-finished, must NOT skip
        session.scalar.side_effect = [5, 2]
        assert await doc_is_ingested(session, "abc123") is False
