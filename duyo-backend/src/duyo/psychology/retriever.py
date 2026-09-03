"""Retrieval layer: query → pgvector search → psychology RAG context string.

Mirrors `textbook/retriever.py`'s shape. Two call sites, two output shapes:

  - `retrieve_for_chat()`  → chat.py, when a child message reads as an
    emotional/psychological topic rather than an academic question. Returns
    a self-contained `[PSIXOLOGIK KONTEKST]` block with its own instructions,
    ready to pass straight into `services/gemini.py::chat()`'s `rag_context`.


CRITICAL: `_CHAT_MIN_SIMILARITY` below is an unvalidated starting guess (no
production traffic to calibrate against yet), unlike textbook/retriever.py's
0.64 floor which was tuned against real observed matches. Revisit once real
psychology-topic queries and their scores can be observed.
"""

from __future__ import annotations

from dataclasses import dataclass

import structlog
from google import genai
from google.genai import types
from sqlalchemy.ext.asyncio import AsyncSession

from duyo.core.config import get_settings
from duyo.models.psychology_chunk import PsychologyChunk
from duyo.psychology import store as chunk_store
from duyo.textbook import embeddings as emb_service

log = structlog.get_logger(__name__)

_DEFAULT_LIMIT = 2
_MAX_CONTEXT_CHARS = 900
_CHAT_MIN_SIMILARITY = 0.55  # draft floor — needs calibration, see module docstring

_GATE_PROMPT = (
    "Sen bolaning xabarini psixologik bilim bazasida qidirish uchun tahlil qilasan.\n"
    "Agar xabar bolaning HIS-TUYG'USI, KAYFIYATI, IJTIMOIY MUNOSABATI yoki "
    "STRESSI bilan bog'liq bo'lsa (masalan xafalik, bezovtalik, do'stlik yoki "
    "oila janjali, imtihon tashvishi, yolg'izlik, jahl, uyqusizlik) — asosiy "
    "mavzuni ifodalovchi qisqa o'zbekcha qidiruv so'rovini qaytar.\n"
    "Agar xabar darslik/fan savoli, salomlashish, buyruq yoki his-tuyg'u "
    "bilan bog'liq bo'lmagan boshqa narsa bo'lsa — FAQAT 'NONE' deb qaytar.\n"
    "FAQAT qidiruv so'rovini YOKI 'NONE' qaytar, boshqa hech narsa yozma.\n\n"
    "Xabar: {q}\nNatija:"
)


@dataclass
class PsychRetrieval:
    context: str
    topic_titles: list[str]


async def _gate_query(raw: str) -> str:
    """Classify whether `raw` is an emotional/psychological topic.

    Returns a condensed search query, or "" if it's not a topical match.
    Falls back to "" (skip retrieval) on any error — this is a nice-to-have
    context layer, never a hard dependency for the chat turn to succeed.
    """
    settings = get_settings()
    if not settings.google_api_key:
        return ""
    try:
        client = genai.Client(api_key=settings.google_api_key)
        resp = await client.aio.models.generate_content(
            model=settings.gemini_model_primary,
            contents=[types.Content(role="user", parts=[types.Part(text=_GATE_PROMPT.format(q=raw))])],
            config=types.GenerateContentConfig(
                max_output_tokens=64,
                temperature=0.0,
                thinking_config=types.ThinkingConfig(thinking_budget=0),
            ),
        )
        normalized = (resp.text or "").strip()
        if not normalized or normalized.upper().startswith("NONE"):
            return ""
        return normalized
    except Exception as exc:
        log.warning("psych_gate_failed", error=str(exc))
        return ""


async def search_topics(
    session: AsyncSession,
    query: str,
    *,
    age_segment: str | None = None,
    limit: int = _DEFAULT_LIMIT,
    min_similarity: float | None = None,
) -> list[tuple[PsychologyChunk, float]]:
    """Return (chunk, similarity_score) pairs, ordered by relevance."""
    try:
        query_vec = await emb_service.embed_query(query)
    except Exception as exc:
        log.warning("psych_embed_query_failed", error=str(exc))
        return []

    try:
        results = await chunk_store.search(session, query_vec, age_segment=age_segment, limit=limit)
    except Exception as exc:
        log.warning("psych_vector_search_failed", error=str(exc))
        return []

    scored = [(chunk, round(score, 3)) for chunk, score in results]
    if min_similarity is not None:
        scored = [(c, s) for c, s in scored if s >= min_similarity]
    return scored


def build_chat_context(chunks_with_scores: list[tuple[PsychologyChunk, float]]) -> str | None:
    """Self-contained context block for direct injection into the chat system prompt."""
    if not chunks_with_scores:
        return None

    lines: list[str] = ["[PSIXOLOGIK KONTEKST]"]
    for chunk, _ in chunks_with_scores:
        lines.append(f"Mavzu: {chunk.title}")
        lines.append("---")
        text = chunk.text[:_MAX_CONTEXT_CHARS]
        if len(chunk.text) > _MAX_CONTEXT_CHARS:
            text += "…"
        lines.append(text)
    lines.append("[/PSIXOLOGIK KONTEKST]")
    lines.append("")
    lines.append(
        "Bola hissiy/ijtimoiy mavzuda gapiryapti. Yuqoridagi kontekstdan "
        "ILHOMLANIB tabiiy, iliq, tinglovchan ohangda javob ber — uni "
        "so'zma-so'z o'qib berma yoki 'bilim bazasi' kabi so'zlarni ishlatma. "
        "Tibbiy yoki klinik tashxis QO'YMA. Agar signal jiddiy ko'rinsa "
        "(masalan uzoq davom etayotgan qattiq tushkunlik), bolani muloyimlik "
        "bilan kattalar bilan gaplashishga undang."
    )
    return "\n".join(lines)


async def retrieve_for_chat(
    session: AsyncSession,
    child_message: str,
    *,
    age_segment: str | None = None,
) -> PsychRetrieval | None:
    """High-level helper used by the chat endpoint's non-academic fallback."""
    query = await _gate_query(child_message)
    if not query:
        # No `message=`. The first 60 characters of what a child typed on
        # the emotional-topic path is the most sensitive text the product
        # holds, and it was going to the container log at INFO.
        log.info("psych_skip_non_topical")
        return None

    results = await search_topics(
        session, query, age_segment=age_segment, limit=_DEFAULT_LIMIT, min_similarity=_CHAT_MIN_SIMILARITY,
    )
    if not results:
        log.info("psych_no_match")
        return None

    context = build_chat_context(results)
    if context is None:
        return None
    log.info("psych_context_built", chunks=len(results), top_score=results[0][1])
    return PsychRetrieval(context=context, topic_titles=[c.title for c, _ in results])


