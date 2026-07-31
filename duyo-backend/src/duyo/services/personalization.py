"""Adaptive personalization — lightweight per-child context for the chat prompt.

No model fine-tuning happens here: this reads the child's most recently
generated parent report (already computed by `analysis/reports.py` and
cached in the `reports` table) and turns its AGGREGATE mood/topic signals
into a short context block the chat system prompt can lean on — e.g. so DUYO
doesn't ask "maktabda qanday o'tdi?" right after the child already vented
about a rough week, or can gently lean into a topic the child usually enjoys.

Privacy: reads ONLY the cached `Report.sections` JSONB (mood_trend, topics,
stress_signals) — never raw message text, matching the §11.3 contract
`analysis/reports.py`/`analysis/guidance.py` already enforce. No new LLM
call: one cheap DB read per turn. Fails safe — returns None on any error, or
when no report exists yet (e.g. the child's first conversations), so a
chat turn never depends on this succeeding.
"""

from __future__ import annotations

import logging
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from duyo.models.report import Report

log = logging.getLogger(__name__)

# Mirrors analysis/guidance.py's "no data" sentinel — never surface it as a signal.
_NO_TREND_SENTINEL = "ma'lumot yetarli emas"


async def build_personalization_context(session: AsyncSession, child_id: UUID) -> str | None:
    """Fetch the child's latest cached report and format it as a short prompt block.

    Returns None when no report exists yet, the report carries no usable
    mood signal, or the fetch fails for any reason.
    """
    try:
        report = await session.scalar(
            select(Report)
            .where(Report.child_id == child_id)
            .order_by(Report.created_at.desc())
            .limit(1)
        )
    except Exception:
        log.exception("personalization_report_fetch_failed child=%s", child_id)
        return None

    if report is None:
        return None

    mood = (report.sections or {}).get("mood", {})
    mood_trend = mood.get("mood_trend")
    if mood_trend in (None, "", _NO_TREND_SENTINEL):
        mood_trend = None
    topics = [t for t in (mood.get("topics") or []) if t][:4]
    stress = mood.get("stress_signals") or None

    if not mood_trend and not topics and not stress:
        return None

    lines = ["[BOLA HAQIDA KONTEKST — faqat ohangni moslashtirish uchun, bolaga hech qachon aytma]"]
    if mood_trend:
        lines.append(f"So'nggi kayfiyat yo'nalishi: {mood_trend}")
    if topics:
        lines.append(f"Odatiy qiziqish mavzulari: {', '.join(topics)}")
    if stress:
        lines.append(f"Diqqat qilinadigan signal: {stress}")
    lines.append(
        "Buni tabiiy ravishda hisobga ol — masalan allaqachon bilgan narsani "
        "qayta so'ramaslik yoki ohangni moslashtirish uchun. Bu kontekstni "
        "bolaga hech qachon aytma yoki unga ishora qilma."
    )
    return "\n".join(lines)
