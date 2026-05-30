"""Persist ClassifiedChunks to PostgreSQL (pgvector).

Two-step process:
  1. upsert_chunks()  — save text + metadata (no embedding yet)
  2. embed_pending()  — generate embeddings for chunks where embedding IS NULL

This separation lets ingestion proceed even if embedding API is unavailable,
and allows re-embedding without re-classifying.
"""

from __future__ import annotations

import structlog
from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from duyo.models.textbook_chunk import TextbookChunk
from duyo.textbook import embeddings as emb_service
from duyo.textbook.schema import ClassifiedChunk

log = structlog.get_logger(__name__)


async def upsert_chunks(
    session: AsyncSession,
    chunks: list[ClassifiedChunk],
) -> int:
    """Insert or update chunks. Returns count of rows written.

    Uses ON CONFLICT (doc_id, chunk_index) DO UPDATE so re-ingesting
    the same file overwrites stale metadata without duplicating rows.
    """
    if not chunks:
        return 0

    rows = [_to_row(c) for c in chunks]

    stmt = pg_insert(TextbookChunk).values(rows)
    stmt = stmt.on_conflict_do_update(
        constraint="uq_chunk_doc_index",
        set_={
            "text": stmt.excluded.text,
            "subject": stmt.excluded.subject,
            "grade": stmt.excluded.grade,
            "language": stmt.excluded.language,
            "script": stmt.excluded.script,
            "chapter": stmt.excluded.chapter,
            "topic": stmt.excluded.topic,
            "topic_id": stmt.excluded.topic_id,
            "subtopic": stmt.excluded.subtopic,
            "content_type": stmt.excluded.content_type,
            "difficulty": stmt.excluded.difficulty,
            "has_formula": stmt.excluded.has_formula,
            "has_table": stmt.excluded.has_table,
            "has_image": stmt.excluded.has_image,
            "classified_by": stmt.excluded.classified_by,
            "needs_review": stmt.excluded.needs_review,
            "confidence_content_type": stmt.excluded.confidence_content_type,
            "confidence_topic": stmt.excluded.confidence_topic,
            "confidence_difficulty": stmt.excluded.confidence_difficulty,
            # Reset embedding on content change so embed_pending re-embeds
            "embedding": None,
        },
    )

    result = await session.execute(stmt)
    await session.flush()

    written = result.rowcount
    log.info("chunks_upserted", count=written)
    return written


async def embed_pending(
    session: AsyncSession,
    *,
    doc_id: str | None = None,
    batch_size: int = 50,
) -> int:
    """Generate embeddings for chunks where embedding IS NULL.

    Args:
        session: Active async DB session.
        doc_id: If set, only embed chunks from this document.
        batch_size: How many chunks to embed per Gemini API call.

    Returns:
        Number of chunks embedded.
    """
    query = select(TextbookChunk).where(TextbookChunk.embedding.is_(None))
    if doc_id:
        query = query.where(TextbookChunk.doc_id == doc_id)
    query = query.order_by(TextbookChunk.doc_id, TextbookChunk.chunk_index)

    result = await session.execute(query)
    pending = list(result.scalars().all())

    if not pending:
        log.info("embed_pending_none")
        return 0

    total_embedded = 0

    for i in range(0, len(pending), batch_size):
        batch = pending[i : i + batch_size]
        texts = [c.text for c in batch]

        vectors = await emb_service.embed_documents(texts)

        for chunk_row, vector in zip(batch, vectors, strict=True):
            await session.execute(
                update(TextbookChunk)
                .where(TextbookChunk.id == chunk_row.id)
                .values(embedding=vector)
            )
        total_embedded += len(batch)
        log.info("batch_embedded", offset=i, count=len(batch))

    await session.flush()
    log.info("embed_pending_done", total=total_embedded)
    return total_embedded


async def search(
    session: AsyncSession,
    query_vector: list[float],
    *,
    subject: str | None = None,
    grade: int | None = None,
    content_type: str | None = None,
    topic_id: str | None = None,
    limit: int = 5,
) -> list[TextbookChunk]:
    """ANN cosine similarity search with optional metadata filters.

    Returns up to `limit` chunks ordered by similarity (most similar first).
    Only returns chunks that have been embedded (embedding IS NOT NULL).
    """
    # Build filter conditions
    filters = [TextbookChunk.embedding.is_not(None)]
    if subject:
        filters.append(TextbookChunk.subject == subject)
    if grade is not None:
        filters.append(TextbookChunk.grade == grade)
    if content_type:
        filters.append(TextbookChunk.content_type == content_type)
    if topic_id:
        filters.append(TextbookChunk.topic_id == topic_id)

    # pgvector cosine distance operator: <=>
    distance_expr = TextbookChunk.embedding.cosine_distance(query_vector)

    stmt = (
        select(TextbookChunk)
        .where(*filters)
        .order_by(distance_expr)
        .limit(limit)
    )

    result = await session.execute(stmt)
    return list(result.scalars().all())


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _to_row(c: ClassifiedChunk) -> dict:
    m = c.metadata
    return {
        "doc_id": c.doc_id,
        "chunk_index": c.chunk_index,
        "source_path": m.source_path,
        "subject": m.subject,
        "grade": m.grade,
        "language": m.language.value,
        "script": m.script.value,
        "chapter": m.chapter,
        "topic": m.topic,
        "topic_id": m.topic_id,
        "subtopic": m.subtopic,
        "content_type": m.content_type.value,
        "difficulty": m.difficulty.value,
        "has_formula": m.has_formula,
        "has_table": m.has_table,
        "has_image": m.has_image,
        "classified_by": m.classified_by,
        "needs_review": m.needs_review,
        "confidence_content_type": m.confidence.content_type,
        "confidence_topic": m.confidence.topic,
        "confidence_difficulty": m.confidence.difficulty,
        "text": c.text,
        "embedding": None,  # filled by embed_pending()
    }
