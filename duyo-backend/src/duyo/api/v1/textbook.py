"""Textbook RAG search endpoint.

GET /v1/textbook/search?q=...&subject=...&grade=...&content_type=...&limit=...

Requires authentication (child or parent token).
Returns ranked chunks from pgvector with approximate similarity scores.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from duyo.api.deps import get_current_user, get_db
from duyo.models.user import User
from duyo.schemas.textbook import ChunkResult, SearchResponse
from duyo.textbook.retriever import search_chunks

router = APIRouter(prefix="/textbook", tags=["textbook"])
log = logging.getLogger(__name__)


@router.get("/search", response_model=SearchResponse)
async def search_textbook(
    q: str = Query(..., min_length=2, max_length=500, description="Search query"),
    subject: str | None = Query(default=None, description="Filter by subject (e.g. matematika)"),
    grade: int | None = Query(default=None, ge=1, le=12, description="Filter by grade"),
    content_type: str | None = Query(
        default=None,
        description="Filter by content type (definition, rule, example, …)",
    ),
    topic_id: str | None = Query(default=None, description="Filter by canonical topic ID"),
    limit: int = Query(default=5, ge=1, le=20, description="Max results"),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> SearchResponse:
    """Semantic search over ingested textbook chunks.

    Embeds `q` with Gemini text-embedding-004, runs cosine ANN search
    against pgvector, applies optional metadata filters, returns ranked results.

    Returns an empty results list if no textbooks have been ingested yet.
    """
    results = await search_chunks(
        db,
        q,
        subject=subject,
        grade=grade,
        content_type=content_type,
        topic_id=topic_id,
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
