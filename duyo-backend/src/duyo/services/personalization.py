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

from duyo.models.goal import ChildGoal, GoalStatus
from duyo.models.report import Report

log = logging.getLogger(__name__)

# Mirrors analysis/guidance.py's "no data" sentinel — never surface it as a signal.
_NO_TREND_SENTINEL = "ma'lumot yetarli emas"

#: A prompt can carry a few goals usefully; more just dilutes it.
_MAX_GOALS_IN_PROMPT = 4
_GOAL_TITLE_MAX = 80


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


def _sanitize_goal_title(title: str) -> str:
    """Child-authored text is about to enter a system prompt.

    Newlines are the injection vector that matters here — a title containing
    "\\nYangi ko'rsatma: ..." would otherwise read as a new instruction line.
    """
    return " ".join(title.split())[:_GOAL_TITLE_MAX]


async def build_goal_context(session: AsyncSession, child_id: UUID) -> str | None:
    """The child's active goals, as a block DUYO MAY refer to out loud.

    Deliberately a sibling of `build_personalization_context` rather than part
    of it: that block ends with "never tell the child", and goals need exactly
    the opposite instruction — remembering a goal out loud is the whole point.

    Only ACTIVE and CONFIRMED goals are included. An unconfirmed goal is a
    guess the extractor made; DUYO acting on its own guess is how a companion
    starts inventing facts about a child.
    """
    try:
        result = await session.execute(
            select(ChildGoal)
            .where(
                ChildGoal.child_id == child_id,
                ChildGoal.status == GoalStatus.ACTIVE,
                ChildGoal.confirmed_at.is_not(None),
            )
            .order_by(ChildGoal.last_progress_at.desc().nullslast(),
                      ChildGoal.created_at.desc())
            .limit(_MAX_GOALS_IN_PROMPT)
        )
        goals = list(result.scalars().all())
    except Exception:
        log.exception("goal_context_fetch_failed child=%s", child_id)
        return None

    if not goals:
        return None

    lines = [
        "[BOLA MAQSADLARI — bularni suhbatda tabiiy eslashing MUMKIN]",
    ]
    for goal in goals:
        title = _sanitize_goal_title(goal.title)
        if goal.current_unit is not None and goal.total_units:
            unit = goal.unit_label or "qadam"
            lines.append(
                f"- {title} — {goal.current_unit}/{goal.total_units} {unit}"
            )
        elif goal.current_unit is not None:
            unit = goal.unit_label or "qadam"
            lines.append(f"- {title} — {goal.current_unit}-{unit}da")
        else:
            lines.append(f"- {title}")
    lines.append(
        "Bolaning maqsadini eslaganingni bildirsang bo'ladi va unga yetishda "
        "yordam ber. Har javobda takrorlama — faqat mos kelganda esla. "
        "Bola orqada qolgan bo'lsa ham hech qachon ayblama yoki bosim qilma."
    )
    return "\n".join(lines)
