"""Persist PsychologyChunks to PostgreSQL (pgvector). Mirrors `textbook/store.py`.

Two-step process:
  1. upsert_topics()  — save text + metadata (no embedding yet)
  2. embed_pending()  — generate embeddings for chunks where embedding IS NULL
"""

from __future__ import annotations

import structlog
from sqlalchemy import select, text, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from duyo.models.psychology_chunk import PsychologyChunk
from duyo.psychology.taxonomy import TAXONOMY, PsychologyTopic
from duyo.textbook import embeddings as emb_service

log = structlog.get_logger(__name__)

# Small corpus — see migration 0014's comment on why lists=1 is fine here.
_IVFFLAT_PROBES = 1


async def upsert_topics(
    session: AsyncSession,
    *,
    language: str = "uz",
    topics: dict[str, PsychologyTopic] | None = None,
) -> int:
    """Insert or update one PsychologyChunk row per taxonomy entry.

    Uses ON CONFLICT (topic_id, language) DO UPDATE so re-running the seed
    script after editing `taxonomy.py` overwrites stale content without
    duplicating rows.
    """
    entries = topics if topics is not None else TAXONOMY
    if not entries:
        return 0

    rows = [
        {
            "topic_id": t.topic_id,
            "title": t.title,
            "age_segment": t.age_segments[0].value if t.age_segments and len(t.age_segments) == 1 else None,
            "language": language,
            "text": t.content,
            "embedding": None,
        }
        for t in entries.values()
    ]

    stmt = pg_insert(PsychologyChunk).values(rows)
    stmt = stmt.on_conflict_do_update(
        constraint="uq_psych_topic_language",
        set_={
            "title": stmt.excluded.title,
            "age_segment": stmt.excluded.age_segment,
            "text": stmt.excluded.text,
            # Reset embedding on content change so embed_pending re-embeds.
            "embedding": None,
        },
    )
    result = await session.execute(stmt)
    await session.flush()

    written = result.rowcount
    log.info("psychology_chunks_upserted", count=written)
    return written


async def embed_pending(session: AsyncSession, *, batch_size: int = 50) -> int:
    """Generate embeddings for chunks where embedding IS NULL."""
    query = (
        select(PsychologyChunk)
        .where(PsychologyChunk.embedding.is_(None))
        .order_by(PsychologyChunk.topic_id)
    )
    pending = list((await session.execute(query)).scalars().all())
    if not pending:
        log.info("psych_embed_pending_none")
        return 0

    total_embedded = 0
    for i in range(0, len(pending), batch_size):
        batch = pending[i : i + batch_size]
        vectors = await emb_service.embed_documents([c.text for c in batch])
        for chunk_row, vector in zip(batch, vectors, strict=True):
            await session.execute(
                update(PsychologyChunk).where(PsychologyChunk.id == chunk_row.id).values(embedding=vector)
            )
        total_embedded += len(batch)

    await session.flush()
    log.info("psych_embed_pending_done", total=total_embedded)
    return total_embedded


async def search(
    session: AsyncSession,
    query_vector: list[float],
    *,
    age_segment: str | None = None,
    limit: int = 3,
) -> list[tuple[PsychologyChunk, float]]:
    """ANN cosine similarity search, optionally filtered to a given age segment
    OR cards that apply to every age segment (age_segment IS NULL)."""
    filters = [PsychologyChunk.embedding.is_not(None)]
    if age_segment is not None:
        filters.append(
            (PsychologyChunk.age_segment == age_segment) | (PsychologyChunk.age_segment.is_(None))
        )

    await session.execute(text(f"SET LOCAL ivfflat.probes = {_IVFFLAT_PROBES}"))

    distance_expr = PsychologyChunk.embedding.cosine_distance(query_vector)
    similarity_expr = (1 - distance_expr).label("similarity")

    stmt = (
        select(PsychologyChunk, similarity_expr)
        .where(*filters)
        .order_by(distance_expr)
        .limit(limit)
    )
    result = await session.execute(stmt)
    return [(row[0], float(row[1])) for row in result.all()]
