"""Crisis Detection Layer 3 — semantic (embedding) classifier.

Per TZ §9.2/§10.2 this is the third of 4 layers. Layer 1 (keyword) only
catches literal phrase matches; Layer 2 (Gemini classifier) is powerful but
adds LLM latency/cost on every turn. Layer 3 sits between them: it embeds the
child's message and compares it by cosine similarity against a curated set of
"anchor" risk phrases (the same phrases Layer 1 matches on, PLUS a small set
of subtler/paraphrased exemplars that literal substring matching misses —
see `tests/test_crisis_detector.py::test_layer1_misses_subtle_or_metaphorical_signals`
for the exact false-negative cases this layer exists to catch).

This is NOT a trained classifier (no labelled dataset/training infra exists
in this repo) — it is a cheap, explainable nearest-neighbour check on top of
the embedding model DUYO already uses for textbook RAG. `models/crisis_event.py`
still calls this "layer 3 (BERT, future)"; a real trained classifier can
replace this module later without changing its call signature.

CRITICAL — like `crisis/keywords.py`, the anchor phrases and the
`crisis_threshold_*` similarity cutoffs (core/config.py) are unvalidated
defaults. Cosine similarity between full-sentence paraphrases rarely reaches
0.95 even for genuine matches (the textbook RAG floor for a confident
same-topic hit is ~0.64-0.77, see textbook/retriever.py) — so these
thresholds MUST be recalibrated against real (message, similarity) samples
before this layer is trusted for anything beyond "escalate, never downgrade"
alongside Layer 1/2.
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
import time
from dataclasses import dataclass

from duyo.core.config import get_settings
from duyo.crisis.keywords import KEYWORDS_BY_CATEGORY, CrisisCategory
from duyo.models.crisis_event import CrisisLevel
from duyo.textbook.embeddings import embed_documents, embed_query

log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Subtle / paraphrased anchors — supplements the literal keyword list with
# exemplars a substring match cannot catch. Draft, needs clinical review.
# ---------------------------------------------------------------------------

SUBTLE_ANCHORS: dict[CrisisCategory, tuple[str, ...]] = {
    CrisisCategory.SUICIDAL: (
        "Hech kim meni sevmaydi",
        "Yo'qolib ketsam yaxshi bo'lardi",
        "Ertaga men bo'lmasam ham hech narsa o'zgarmaydi",
        "Menga baribir, nima bo'lsa bo'lsin",
        "Никому не станет хуже, если меня не будет",
        "Все было бы легче, если бы меня не было",
        "It wouldn't matter if I wasn't here tomorrow",
        "Everyone would be better off without me",
    ),
    CrisisCategory.SELF_HARM: (
        "O'zimni jazolashim kerak",
        "Og'riq his qilsam yengil bo'ladi",
        "Мне нужно наказать себя",
        "I deserve to feel pain",
    ),
    CrisisCategory.ABUSE_VICTIM: (
        "Uyda o'zimni xavfsiz his qilmayman",
        "Bu haqda gapirishdan qo'rqaman",
        "Дома мне страшно находиться одному с ним",
        "I'm scared to be alone with him",
    ),
    CrisisCategory.NEGLECT: (
        "Kimga kerak ekanimni bilmayman",
        "O'zimga o'zim qarayman, boshqa iloj yo'q",
        "Никто не спрашивает, поел ли я",
    ),
    CrisisCategory.BULLYING: (
        "Maktabga borgim kelmaydi, hamma mendan nafratlanadi",
        "O'zimni hammadan yashirgim keladi",
        "I dread going to school every single day",
    ),
}


@dataclass(frozen=True)
class Layer3Result:
    """Output of Layer 3 semantic detection."""

    level: CrisisLevel
    confidence: float  # best cosine similarity found, 0.0 on any failure
    category: CrisisCategory | None
    closest_phrase: str | None
    latency_ms: int


_RANK = {CrisisLevel.GREEN: 0, CrisisLevel.YELLOW: 1, CrisisLevel.ORANGE: 2, CrisisLevel.RED: 3}


def _level_rank(level: CrisisLevel) -> int:
    return _RANK[level]


def _flatten_anchors() -> list[tuple[str, CrisisCategory]]:
    """All keyword-list phrases + subtle exemplars, as (text, category) pairs."""
    pairs: list[tuple[str, CrisisCategory]] = []
    for category, by_lang in KEYWORDS_BY_CATEGORY.items():
        for phrases in by_lang.values():
            pairs.extend((phrase, category) for phrase in phrases)
    for category, phrases in SUBTLE_ANCHORS.items():
        pairs.extend((phrase, category) for phrase in phrases)
    return pairs


def _cosine(a: list[float], b: list[float]) -> float:
    """Dot product of two already-L2-normalised vectors == cosine similarity."""
    return sum(x * y for x, y in zip(a, b, strict=True))


def _level_for_score(score: float) -> CrisisLevel:
    settings = get_settings()
    if score >= settings.crisis_threshold_red:
        return CrisisLevel.RED
    if score >= settings.crisis_threshold_orange:
        return CrisisLevel.ORANGE
    if score >= settings.crisis_threshold_yellow:
        return CrisisLevel.YELLOW
    return CrisisLevel.GREEN


# Anchor embeddings are computed once per process (small, static set) and
# cached — mirrors KeywordCrisisDetector's "build once at startup" idiom, but
# lazily + async since embedding requires a network call. A lock prevents a
# thundering herd of concurrent first-requests from all embedding the anchor
# set in parallel.
#
# WARMING IS NEVER DONE ON A REQUEST. There are 217 anchor phrases and
# gemini-embedding-001 takes one text per call, so building this cache is 217
# sequential API calls — around a minute. Doing that inline made the first
# chat turn after every restart take ~68 seconds; the mobile client gave up
# first, its disconnect cancelled the warm-up, the cache was never populated,
# and the NEXT turn started the same 217 calls from scratch. Chat was
# permanently dead from the first deploy onward, and every attempt to read the
# backend log found nothing, because the turn never completed enough to log.
#
# So: warm in the background (see warm_anchors, called from the app lifespan),
# and let `classify` return immediately while it is still cold.
_anchor_cache: list[tuple[str, CrisisCategory, list[float]]] | None = None
_anchor_lock = asyncio.Lock()


async def warm_anchors() -> None:
    """Build the anchor cache. Safe to call repeatedly; never raises.

    Call this OFF the request path — from application startup, or as a
    background task. It takes about a minute on a cold process.
    """
    global _anchor_cache
    if _anchor_cache is not None:
        return
    async with _anchor_lock:
        if _anchor_cache is not None:  # another task won the race
            return
        pairs = _flatten_anchors()
        try:
            started = time.perf_counter()
            vectors = await embed_documents([text for text, _ in pairs])
            _anchor_cache = [
                (text, cat, vec)
                for (text, cat), vec in zip(pairs, vectors, strict=True)
            ]
            log.warning(
                "crisis layer 3 anchors warmed: %d phrases in %.1fs",
                len(pairs), time.perf_counter() - started,
            )
        except Exception:
            # Leaving the cache empty is the correct outcome: Layer 3 stays
            # disabled and Layers 1 and 2 continue to screen every message.
            log.exception("crisis layer 3 anchor warm-up failed; layer stays cold")


def anchors_ready() -> bool:
    """Whether Layer 3 can classify without blocking."""
    return _anchor_cache is not None


#: Held so the task is not garbage-collected mid-flight, and so a second
#: cold message does not start a second warm-up alongside the first.
_warm_task: asyncio.Task[None] | None = None


def _spawn_warm_up() -> None:
    """Start a background warm-up if one is not already running."""
    global _warm_task
    if _warm_task is not None and not _warm_task.done():
        return
    # No running loop (a synchronous context, e.g. some tests) — nothing to
    # warm here; the startup hook covers the real application.
    with contextlib.suppress(RuntimeError):
        _warm_task = asyncio.create_task(warm_anchors())


async def _get_anchors() -> list[tuple[str, CrisisCategory, list[float]]]:
    """The cached anchors. Callers must check `anchors_ready()` first —
    this still builds them if cold, which is why nothing on a request path
    may call it without that guard."""
    await warm_anchors()
    return _anchor_cache or []


def reset_cache() -> None:
    """Clear the anchor embedding cache. Test-only."""
    global _anchor_cache
    _anchor_cache = None


async def classify(child_message: str, current_level: CrisisLevel) -> Layer3Result:
    """Embed `child_message` and compare to the anchor set.

    `current_level` is the level Layer 1/2 already settled on — Layer 3 can
    only escalate above it, never downgrade (same safety policy as Layer 2).
    Fails safe on any error: returns `current_level` unchanged with
    confidence=0.0, and never raises.
    """
    start = time.perf_counter()

    # Cold cache → skip this layer for THIS message rather than building it
    # inline. See the note above _anchor_cache: warming is 217 sequential
    # embedding calls, and waiting for it is what killed every chat turn after
    # a restart. Layers 1 and 2 have already screened the message; Layer 3
    # comes online a minute or so after startup and catches everything after
    # that. A background warm-up is kicked off here too, so the layer still
    # recovers even if the startup hook never ran (tests, a worker respawn).
    if not anchors_ready():
        log.warning("crisis layer 3 cold — skipping this message, warming in background")
        _spawn_warm_up()
        return Layer3Result(
            level=current_level, confidence=0.0, category=None, closest_phrase=None,
            latency_ms=int((time.perf_counter() - start) * 1000),
        )

    try:
        anchors = await _get_anchors()
        query_vec = await embed_query(child_message)
    except Exception:
        log.exception("Crisis Layer 3 embedding failed; falling back to current level")
        return Layer3Result(
            level=current_level, confidence=0.0, category=None, closest_phrase=None,
            latency_ms=int((time.perf_counter() - start) * 1000),
        )

    best_score = -1.0
    best_text: str | None = None
    best_category: CrisisCategory | None = None
    for text, category, vec in anchors:
        score = _cosine(query_vec, vec)
        if score > best_score:
            best_score, best_text, best_category = score, text, category

    latency_ms = int((time.perf_counter() - start) * 1000)
    level = _level_for_score(best_score)

    # Safety policy: never silently downgrade below the level Layer 1/2 found.
    if _level_rank(level) < _level_rank(current_level):
        level = current_level

    return Layer3Result(
        level=level, confidence=round(max(best_score, 0.0), 4),
        category=best_category, closest_phrase=best_text, latency_ms=latency_ms,
    )
