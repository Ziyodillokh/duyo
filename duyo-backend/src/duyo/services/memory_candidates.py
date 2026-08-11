"""Personal-memory candidate extraction — stateless, NEVER persisted server-side.

This is the server half of DUYO's local-first memory feature. It mirrors
`services/goals.py` in spirit (an LLM extractor over one child message,
conservative to a fault) but differs in one deliberate way: `extract_child_insights`
writes an unconfirmed `ChildGoal` row to Postgres, because a goal is meant to
be visible across the family (parent-set goals, social goal-matching) and to
survive a reinstall. A personal-memory candidate is neither — it is a private
fact about the child that belongs on the child's own device, so this module
has no database import at all. The caller (api/v1/chat.py) hands the result
straight back in the HTTP response for THIS turn only; nothing here is ever
written to a table, a cache, or a log line beyond a failure trace.

The device is the actual gatekeeper: its own on-device Memory Guard
(duyo-mobile/src/lib/memory-guard.ts) re-checks the category/content before
ever showing the "eslab qolaymi?" consent prompt, and nothing is written to
the child's encrypted local database without an explicit yes. This module is
therefore best read as "the LLM's suggestion", not "the memory system" — see
MEMORY_CANDIDATE_EXTRACT_PROMPT in prompts.py for the classification rules
(including the sensitive-data exclusions) and duyo-docs for the full
Local-First Memory architecture note.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass

from google.genai import types

from duyo.core.config import get_settings
from duyo.prompts import MEMORY_CANDIDATE_EXTRACT_PROMPT
from duyo.services.gemini import get_client

log = logging.getLogger(__name__)

#: Below this the utterance cannot carry a durable personal fact; skipping
#: saves a model call on every "ha", "rahmat", "zo'r" (same rationale as
#: services/goals.py's _MIN_LEN).
_MIN_LEN = 12
_CONTENT_MAX = 160

# Deliberately excludes "goals" — INSIGHT_EXTRACT_PROMPT already owns that shape
# of statement, and "relationships" — that is a graph EDGE between two
# memories (see duyo-mobile/src/lib/memory-graph.ts), not a content category
# an extractor writes text into.
_CATEGORIES = frozenset(
    {"profile", "preferences", "interests", "learning", "research", "notes"}
)


@dataclass(frozen=True)
class MemoryCandidate:
    category: str
    content: str


async def extract_memory_candidate(message: str) -> MemoryCandidate | None:
    """Suggest a short, reusable personal-memory fact from one child message.

    Fails safe on every path — a missing API key, a network error, a
    malformed model response, or an out-of-vocabulary category all return
    None rather than raise, so a broken extractor can never turn into a
    broken chat turn.
    """
    if len(message.strip()) < _MIN_LEN:
        return None

    settings = get_settings()
    if not settings.memory_candidate_extraction_enabled:
        return None

    try:
        # get_client() inside the try — see services/crisis_l2.py's note on
        # why every Gemini caller here builds the client inside its own
        # handler rather than at import time.
        resp = await get_client().aio.models.generate_content(
            model=settings.gemini_model_primary,
            contents=f"Bola aytdi: {message}",
            config=types.GenerateContentConfig(
                system_instruction=MEMORY_CANDIDATE_EXTRACT_PROMPT,
                max_output_tokens=250,
                temperature=0.0,  # extraction, not creativity
                thinking_config=types.ThinkingConfig(
                    thinking_budget=settings.gemini_thinking_budget_flash
                ),
                response_mime_type="application/json",
            ),
        )
        data = json.loads((resp.text or "").strip())
    except Exception:
        log.exception("memory_candidate_extract_failed")
        return None

    if not isinstance(data, dict) or not data.get("has_memory"):
        return None

    category = str(data.get("category", "")).strip().lower()
    if category not in _CATEGORIES:
        return None

    content = " ".join(str(data.get("content", "")).split())[:_CONTENT_MAX]
    if len(content) < 5:
        return None

    return MemoryCandidate(category=category, content=content)
