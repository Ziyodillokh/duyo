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

from dataclasses import dataclass

import structlog
from google import genai
from google.genai import types
from sqlalchemy.ext.asyncio import AsyncSession

from duyo.core.config import get_settings
from duyo.models.textbook_chunk import TextbookChunk
from duyo.textbook import embeddings as emb_service
from duyo.textbook import store as chunk_store

log = structlog.get_logger(__name__)

# Maximum number of chunks to inject per chat turn.
# More chunks = more context = better accuracy, but also higher token cost.
_DEFAULT_LIMIT = 3
_MAX_CONTEXT_CHARS = 2000  # truncate chunks to keep system prompt manageable

# Minimum cosine similarity for a chunk to be injected into a chat reply.
# Relevant matches score ~0.65-0.77; off-topic/typo matches land ~0.55-0.60.
# A floor drops irrelevant context (e.g. a misspelled "Vakoul" matching a
# Russian-textbook chunk) so the model answers from its own knowledge instead
# of being misled. The direct /search endpoint keeps no floor (min_similarity
# defaults to None) so it can surface everything for debugging.
_CHAT_MIN_SIMILARITY = 0.68


@dataclass
class RagRetrieval:
    """What chat needs from one retrieval: the prompt context block plus the
    distinct (subject, grade, topic) refs for source attribution."""
    context: str
    refs: list[tuple[str, int, str | None]]


# Children misspell ("Vakoul" → "vakuol"). Normalising the query before
# embedding recovers the right textbook section. Falls back to the raw query.
_NORMALIZE_PROMPT = (
    "Sen o'quvchining xabarini darslik bazasida qidirish uchun tahlil qilasan.\n"
    "Agar xabar darslik javob bera oladigan BILIM/MAVZU savoli bo'lsa "
    "(masalan 'fotosintez nima', 'vakuol'), imlo xatolarini tuzatib, qisqa "
    "o'zbekcha qidiruv so'rovini (asosiy atamalar) qaytar.\n"
    "Agar xabar salomlashish, oddiy suhbat, buyruq yoki ko'rsatma bo'lsa "
    "(masalan 'salom', 'darslik bo'yicha javob ber', 'soddaroq tushuntir', "
    "'15 yoshli bolaga javob ber'), yoki maxsus ism/atama darslik mavzusi "
    "emas, yoki tushunarsiz bo'lsa — FAQAT 'NONE' deb qaytar.\n"
    "FAQAT qidiruv so'rovini YOKI 'NONE' qaytar, boshqa hech narsa yozma.\n\n"
    "Xabar: {q}\nNatija:"
)


async def _normalize_query(raw: str) -> str:
    """Spelling-correct and condense a child's question for retrieval.

    Uses Gemini Flash. Returns the raw query unchanged on any error so RAG
    never breaks because of normalisation.
    """
    settings = get_settings()
    if not settings.google_api_key:
        return raw
    try:
        client = genai.Client(api_key=settings.google_api_key)
        resp = await client.aio.models.generate_content(
            model=settings.gemini_model_primary,
            contents=[types.Content(role="user", parts=[types.Part(text=_NORMALIZE_PROMPT.format(q=raw))])],
            config=types.GenerateContentConfig(
                max_output_tokens=64,
                temperature=0.0,
                thinking_config=types.ThinkingConfig(thinking_budget=0),
            ),
        )
        normalized = (resp.text or "").strip()
        return normalized or raw
    except Exception as exc:  # never let normalisation break RAG
        log.warning("query_normalize_failed", error=str(exc))
        return raw


async def search_chunks(
    session: AsyncSession,
    query: str,
    *,
    subject: str | None = None,
    grade: int | None = None,
    content_type: str | None = None,
    topic_id: str | None = None,
    limit: int = _DEFAULT_LIMIT,
    min_similarity: float | None = None,
) -> list[tuple[TextbookChunk, float]]:
    """Return (chunk, similarity_score) pairs, ordered by relevance.

    similarity = 1 - cosine_distance (so 1.0 = identical, 0.0 = orthogonal).
    Returns empty list if embedding API is unavailable or no chunks are stored.
    When ``min_similarity`` is set, chunks scoring below it are dropped (used by
    chat to avoid injecting off-topic context); left None for the search API.
    """
    try:
        query_vec = await emb_service.embed_query(query)
    except Exception as exc:
        log.warning("embed_query_failed", error=str(exc))
        return []

    try:
        results = await chunk_store.search(
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

    # store.search() returns (chunk, similarity) pairs with real pgvector
    # cosine similarity (1 - distance). Round for a tidy API response.
    scored = [(chunk, round(score, 3)) for chunk, score in results]
    if min_similarity is not None:
        scored = [(c, s) for c, s in scored if s >= min_similarity]
    return scored


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
        "Quyidagi darslik matnidan FOYDALANIB javob ber. Javob boshida qaysi "
        "sinf va fan darsligidan ekanini tabiiy ayt, masalan: "
        "\"6-sinf Botanika darsligiga ko'ra, ...\". "
        "MUHIM: hech qachon \"kontekst\", \"berilgan matn\" yoki boshqa fan "
        "darsliklari nomlarini bolaga aytma. Agar bu matn savolga mos kelmasa, "
        "matn yo'qdek, jimgina o'z bilimingdan to'g'ri javob ber va mos "
        "kelmasligini umuman izohlama."
    )

    return "\n".join(lines)


async def retrieve_for_chat(
    session: AsyncSession,
    child_message: str,
    *,
    grade: int | None = None,
    subject: str | None = None,
) -> RagRetrieval | None:
    """High-level helper used by the chat endpoint.

    Normalises the (possibly misspelled) child message and applies a similarity
    floor so only on-topic textbook context reaches the model. Returns the
    context block and source refs, or None when nothing relevant is found.
    """
    normalized = await _normalize_query(child_message)
    # Topic gate: greetings, commands, meta-instructions and gibberish are not
    # textbook queries — skip RAG so we don't inject keyword-overlap junk.
    if not normalized or normalized.strip().upper().startswith("NONE"):
        log.info("rag_skip_non_topical", query=child_message[:60])
        return None
    results = await search_chunks(
        session, normalized, grade=grade, subject=subject,
        limit=_DEFAULT_LIMIT, min_similarity=_CHAT_MIN_SIMILARITY,
    )
    if not results:
        log.info("rag_no_match", query=normalized[:60])
        return None

    # Keep only the dominant subject (the top hit's): drop cross-subject
    # outliers so the injected context and the citation stay coherent.
    top_subject = results[0][0].subject
    results = [(c, s) for c, s in results if c.subject == top_subject]

    context = build_rag_context(results)
    if context is None:
        return None
    seen: set[tuple[str, int]] = set()
    refs: list[tuple[str, int, str | None]] = []
    for chunk, _ in results:
        key = (chunk.subject, chunk.grade)
        if key in seen:
            continue
        seen.add(key)
        refs.append((chunk.subject, chunk.grade, chunk.topic))
    log.info("rag_context_built", chunks=len(results), top_score=results[0][1], query=normalized[:60])
    return RagRetrieval(context=context, refs=refs)
