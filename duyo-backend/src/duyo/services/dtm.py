"""DTM practice question generation — grounded in the ingested textbooks.

Pulls a random sample of textbook chunks for a subject and asks Gemini to write
multiple-choice questions from THAT content (grounded → accurate), rather than
free-generating from model memory. Fails safe to [] so the screen degrades.
"""

from __future__ import annotations

import json

from google.genai import types
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from duyo.core.config import get_settings
from duyo.models.textbook_chunk import TextbookChunk
from duyo.services.gemini import get_client

_MAX_COUNT = 10
_SAMPLE_CHUNKS = 14

_PROMPT = (
    "Quyidagi darslik parchalari MAVZUSIGA oid {count} ta DTM uslubidagi test "
    "savoli tuz. Har savol: aniq, bitta to'g'ri javobli, 4 ta variant.\n"
    "Agar parchalar formula yoki qisqa bo'lsa, o'sha mavzu bo'yicha O'ZING "
    "to'liq, yechiladigan savollar tuz (masalan hisob-kitob, ta'rif).\n"
    "FAQAT shu JSON formatda javob ber (correct_index — butun son):\n"
    '{{"questions": [{{"text": "savol", "choices": ["A","B","C","D"], '
    '"correct_index": 0, "explanation": "qisqa izoh"}}]}}\n\n'
    "Darslik parchalari:\n{content}"
)


async def generate_questions(
    db: AsyncSession, *, subject: str, count: int = 5
) -> list[dict]:
    """Return up to `count` grounded MCQs for `subject`, or [] if unavailable."""
    count = max(1, min(count, _MAX_COUNT))
    rows = (
        await db.execute(
            select(TextbookChunk.text)
            .where(TextbookChunk.subject == subject)
            .order_by(func.random())
            .limit(_SAMPLE_CHUNKS)
        )
    ).scalars().all()
    if not rows:
        return []
    content = "\n---\n".join(t[:1200] for t in rows)

    settings = get_settings()
    try:
        client = get_client()
        resp = await client.aio.models.generate_content(
            model=settings.gemini_model_primary,
            contents=_PROMPT.format(count=count, content=content),
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
