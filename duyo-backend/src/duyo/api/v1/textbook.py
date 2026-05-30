"""Textbook RAG API — search, review, approve, stats.

Endpoints:
  GET  /v1/textbook/search                 semantic search (authenticated)
  GET  /v1/textbook/review                 list needs_review chunks (admin)
  PATCH /v1/textbook/chunks/{id}/approve   approve + optional field override
  PATCH /v1/textbook/chunks/{id}/reject    delete chunk from DB
  GET  /v1/textbook/stats                  ingestion statistics (admin)
"""

from __future__ import annotations

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from duyo.api.deps import get_current_user, get_db
from duyo.models.textbook_chunk import TextbookChunk
from duyo.models.user import User
from duyo.schemas.textbook import (
    ApprovePayload,
    ReviewChunk,
    ReviewListResponse,
    SearchResponse,
    ChunkResult,
    StatsResponse,
)
from duyo.textbook.retriever import search_chunks

router = APIRouter(prefix="/textbook", tags=["textbook"])
log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Search
# ---------------------------------------------------------------------------

@router.get("/search", response_model=SearchResponse)
async def search_textbook(
    q: str = Query(..., min_length=2, max_length=500),
    subject: str | None = Query(default=None),
    grade: int | None = Query(default=None, ge=1, le=12),
    content_type: str | None = Query(default=None),
    topic_id: str | None = Query(default=None),
    limit: int = Query(default=5, ge=1, le=20),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> SearchResponse:
    """Semantic search over ingested textbook chunks.

    Returns empty list if no textbooks have been ingested or embedding API is down.
    """
    results = await search_chunks(
        db, q,
        subject=subject, grade=grade,
        content_type=content_type, topic_id=topic_id,
        limit=limit,
    )

    chunk_results = [
        ChunkResult(
            text=chunk.text,
            subject=chunk.subject,
            grade=chunk.grade,
            language=chunk.language,
            topic=chunk.topic,
            topic_id=chunk.topic_id,
            content_type=chunk.content_type,
            difficulty=chunk.difficulty,
            has_formula=chunk.has_formula,
            source_path=chunk.source_path,
            similarity=score,
        )
        for chunk, score in results
    ]

    log.info("textbook_search", query=q[:60], results=len(chunk_results))
    return SearchResponse(query=q, results=chunk_results, total=len(chunk_results))


# ---------------------------------------------------------------------------
# Review queue
# ---------------------------------------------------------------------------

@router.get("/review", response_model=ReviewListResponse)
async def list_review_queue(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    subject: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> ReviewListResponse:
    """List chunks flagged needs_review=true, ordered by ingestion time.

    These chunks had low classifier confidence and require a human to verify
    the content_type / topic before they are used for retrieval.
    """
    query = select(TextbookChunk).where(TextbookChunk.needs_review.is_(True))
    if subject:
        query = query.where(TextbookChunk.subject == subject)
    query = query.order_by(TextbookChunk.created_at.asc())

    count_q = select(func.count()).select_from(
        query.subquery()
    )
    total = (await db.scalar(count_q)) or 0

    offset = (page - 1) * page_size
    rows = (await db.scalars(query.offset(offset).limit(page_size))).all()

    return ReviewListResponse(
        chunks=[_to_review_chunk(r) for r in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.patch("/chunks/{chunk_id}/approve", status_code=status.HTTP_200_OK)
async def approve_chunk(
    chunk_id: UUID,
    payload: ApprovePayload,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> dict[str, str]:
    """Approve a chunk: clear needs_review flag, optionally override fields.

    Approved chunks remain in DB and are eligible for embedding + retrieval.
    """
    updates: dict = {"needs_review": False}
    if payload.content_type is not None:
        updates["content_type"] = payload.content_type
    if payload.topic is not None:
        updates["topic"] = payload.topic
    if payload.topic_id is not None:
        updates["topic_id"] = payload.topic_id
    if payload.difficulty is not None:
        updates["difficulty"] = payload.difficulty

    result = await db.execute(
        update(TextbookChunk)
        .where(TextbookChunk.id == chunk_id)
        .values(**updates)
    )
    if result.rowcount == 0:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Chunk not found")

    log.info("chunk_approved", chunk_id=str(chunk_id))
    return {"status": "approved", "id": str(chunk_id)}


@router.patch("/chunks/{chunk_id}/reject", status_code=status.HTTP_200_OK)
async def reject_chunk(
    chunk_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> dict[str, str]:
    """Reject and delete a chunk from the knowledge base.

    Use when a chunk is noise, duplicate, or incorrect.
    Deletion is permanent — re-ingest the source file to restore.
    """
    result = await db.execute(
        delete(TextbookChunk).where(TextbookChunk.id == chunk_id)
    )
    if result.rowcount == 0:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Chunk not found")

    log.info("chunk_rejected", chunk_id=str(chunk_id))
    return {"status": "rejected", "id": str(chunk_id)}


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------

@router.get("/stats", response_model=StatsResponse)
async def get_stats(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> StatsResponse:
    """Ingestion statistics: totals, embedding coverage, review queue size."""
    total = (await db.scalar(select(func.count(TextbookChunk.id)))) or 0
    embedded = (
        await db.scalar(
            select(func.count(TextbookChunk.id)).where(
                TextbookChunk.embedding.is_not(None)
            )
        )
    ) or 0
    pending = (
        await db.scalar(
            select(func.count(TextbookChunk.id)).where(
                TextbookChunk.needs_review.is_(True)
            )
        )
    ) or 0

    # Breakdown by subject
    subject_rows = (
        await db.execute(
            select(TextbookChunk.subject, func.count(TextbookChunk.id))
            .group_by(TextbookChunk.subject)
            .order_by(func.count(TextbookChunk.id).desc())
        )
    ).all()

    # Breakdown by content_type
    ct_rows = (
        await db.execute(
            select(TextbookChunk.content_type, func.count(TextbookChunk.id))
            .group_by(TextbookChunk.content_type)
            .order_by(func.count(TextbookChunk.id).desc())
        )
    ).all()

    return StatsResponse(
        total_chunks=total,
        embedded_chunks=embedded,
        pending_review=pending,
        by_subject={row[0]: row[1] for row in subject_rows},
        by_content_type={row[0]: row[1] for row in ct_rows},
    )


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _to_review_chunk(row: TextbookChunk) -> ReviewChunk:
    return ReviewChunk(
        id=row.id,
        doc_id=row.doc_id,
        chunk_index=row.chunk_index,
        text=row.text,
        subject=row.subject,
        grade=row.grade,
        topic=row.topic,
        topic_id=row.topic_id,
        content_type=row.content_type,
        difficulty=row.difficulty,
        has_formula=row.has_formula,
        has_table=row.has_table,
        has_image=row.has_image,
        classified_by=row.classified_by,
        confidence_content_type=row.confidence_content_type,
        source_path=row.source_path,
    )
