"""Retrieval layer: query → pgvector search → RAG context string.

Used by:
  - GET /v1/textbook/search  (direct API response)
  - POST /v1/chat            (injected into Gemini system prompt)

RAG context format injected into system prompt:
  [DARSLIK KONTEKST]
  Fan: matematika | Sinf: 6 | Mavzu: Kasrlar
  ---
  <chunk text>
  ---
  <chunk text>
  [/DARSLIK KONTEKST]

If no chunks are found, returns None (caller falls back to normal generation).
"""

from __future__ import annotations

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from duyo.models.textbook_chunk import TextbookChunk
from duyo.textbook import embeddings as emb_service
from duyo.textbook import store as chunk_store

log = structlog.get_logger(__name__)

# Maximum number of chunks to inject per chat turn.
# More chunks = more context = better accuracy, but also higher token cost.
_DEFAULT_LIMIT = 3
_MAX_CONTEXT_CHARS = 2000  # truncate chunks to keep system prompt manageable


async def search_chunks(
    session: AsyncSession,
    query: str,
    *,
    subject: str | None = None,
    grade: int | None = None,
    content_type: str | None = None,
    topic_id: str | None = None,
    limit: int = _DEFAULT_LIMIT,
) -> list[tuple[TextbookChunk, float]]:
    """Return (chunk, similarity_score) pairs, ordered by relevance.

    similarity = 1 - cosine_distance (so 1.0 = identical, 0.0 = orthogonal).
    Returns empty list if embedding API is unavailable or no chunks are stored.
    """
    try:
        query_vec = await emb_service.embed_query(query)
    except Exception as exc:
        log.warning("embed_query_failed", error=str(exc))
        return []

    try:
        chunks = await chunk_store.search(
            session,
            query_vec,
            subject=subject,
            grade=grade,
            content_type=content_type,
            topic_id=topic_id,
            limit=limit,
        )
    except Exception as exc:
        log.warning("vector_search_failed", error=str(exc))
        return []

    if not chunks:
        return []

    # pgvector returns chunks in cosine distance order (lower = better).
    # We need to compute similarity = 1 - distance for the API response.
    # Since SQLAlchemy doesn't expose the distance in the result directly,
    # we approximate: the first result has highest similarity.
    # For the API we compute approximate similarity via dot product estimation.
    results = []
    for i, chunk in enumerate(chunks):
        # Approximate similarity: rank-based decay as a simple heuristic.
        # Replace with real distance when pgvector exposes it via label.
        approx_similarity = max(0.0, 1.0 - i * 0.05)
        results.append((chunk, round(approx_similarity, 3)))

    return results


def build_rag_context(chunks_with_scores: list[tuple[TextbookChunk, float]]) -> str | None:
    """Format retrieved chunks as a RAG context block for the system prompt.

    Returns None if the list is empty (caller should skip injection).
    """
    if not chunks_with_scores:
        return None

    lines: list[str] = ["[DARSLIK KONTEKST]"]

    for chunk, _ in chunks_with_scores:
        meta_parts = [f"Fan: {chunk.subject}", f"Sinf: {chunk.grade}"]
        if chunk.topic:
            meta_parts.append(f"Mavzu: {chunk.topic}")
        if chunk.content_type:
            meta_parts.append(f"Tur: {chunk.content_type}")
        lines.append(" | ".join(meta_parts))
        lines.append("---")
        # Truncate very long chunks to keep the system prompt manageable
        text = chunk.text[:_MAX_CONTEXT_CHARS]
        if len(chunk.text) > _MAX_CONTEXT_CHARS:
            text += "…"
        lines.append(text)

    lines.append("[/DARSLIK KONTEKST]")
    lines.append("")
    lines.append(
        "Yuqoridagi darslik matniga asoslanib javob ber. "
        "Agar kontekst bolaning savoliga mos kelmasa, o'z bilimingdan foydalanasan."
    )

    return "\n".join(lines)


async def retrieve_for_chat(
    session: AsyncSession,
    child_message: str,
    *,
    grade: int | None = None,
    subject: str | None = None,
) -> str | None:
    """High-level helper used by the chat endpoint.

    Returns a formatted RAG context string or None if nothing relevant found.
    """
    results = await search_chunks(
        session,
        child_message,
        grade=grade,
        subject=subject,
        limit=_DEFAULT_LIMIT,
    )
    if not results:
        return None

    context = build_rag_context(results)
    log.info(
        "rag_context_built",
        chunks=len(results),
        grade=grade,
        subject=subject,
    )
    return context
