"""Language-practice question generation — content-library "Til" mashqlari.

Grounds generation in a published `ContentItem(type=LANGUAGE)` passage when one
exists for the target language; otherwise falls back to a fully AI-generated,
age-appropriate exercise (mirrors `services/dtm.py`'s grounded-generation shape,
but DTM has no such fallback since textbook grounding is mandatory there).
"""

from __future__ import annotations

import json

from google.genai import types
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from duyo.core.config import get_settings
from duyo.models.child import AgeSegment
from duyo.models.content import ContentItem, ContentType
from duyo.prompts import LANGUAGE_PRACTICE_PROMPT
from duyo.services.gemini import get_client

_MAX_COUNT = 10
_SAMPLE_ITEMS = 3

_AGE_HINTS: dict[AgeSegment, str] = {
    AgeSegment.JUNIOR: "7-10 yosh, juda sodda so'z va gaplar",
    AgeSegment.EXPLORER: "11-13 yosh, o'rta daraja",
    AgeSegment.COMPANION: "14-16 yosh, murakkabroq grammatika",
}


async def generate_practice(
    db: AsyncSession,
    *,
    language: str,
    age_segment: AgeSegment,
    topic: str | None = None,
    count: int = 5,
) -> list[dict]:
    """Return up to `count` MCQ language-practice questions, or [] on failure."""
    count = max(1, min(count, _MAX_COUNT))

    rows = (
        await db.execute(
            select(ContentItem.body)
            .where(
                ContentItem.type == ContentType.LANGUAGE,
                ContentItem.language == language,
                ContentItem.published.is_(True),
            )
            .order_by(func.random())
            .limit(_SAMPLE_ITEMS)
        )
    ).scalars().all()
    material = "\n---\n".join(t[:1200] for t in rows if t) or (topic or "")

    settings = get_settings()
    age_hint = _AGE_HINTS.get(age_segment, _AGE_HINTS[AgeSegment.EXPLORER])
    try:
        client = get_client()
        resp = await client.aio.models.generate_content(
            model=settings.gemini_model_primary,
            contents=LANGUAGE_PRACTICE_PROMPT.format(
                language=language, count=count, age_hint=age_hint, material=material,
            ),
            config=types.GenerateContentConfig(
                max_output_tokens=2000,
                temperature=0.5,
                thinking_config=types.ThinkingConfig(thinking_budget=0),
                response_mime_type="application/json",
            ),
        )
        data = json.loads((resp.text or "").strip())
    except Exception:  # never break the screen
        return []

    out: list[dict] = []
    for q in (data.get("questions") or [])[:count]:
        choices = [str(c)[:200] for c in (q.get("choices") or [])]
        try:
            ci = int(q.get("correct_index"))  # Gemini sometimes returns a string
        except (TypeError, ValueError):
            continue
        if len(choices) < 2 or not (0 <= ci < len(choices)):
            continue
        out.append({
            "text": str(q.get("text", ""))[:500],
            "choices": choices,
            "correct_index": ci,
            "explanation": str(q.get("explanation", ""))[:400],
        })
    return out
