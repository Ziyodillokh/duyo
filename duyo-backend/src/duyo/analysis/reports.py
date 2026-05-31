"""Parent 10-day report generation (Concept §11).

Hybrid: metric aggregates are computed in code (cheap, deterministic); a single
Gemini call adds the mood/topic/stress narrative. Privacy contract (§11.3):
conversation TEXT is never returned to the parent or stored — only aggregates.

build_report() is the entry point used by the endpoint.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from uuid import UUID

from google.genai import types
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from duyo.analysis.guidance import build_guidance
from duyo.core.config import get_settings
from duyo.models.conversation import Conversation
from duyo.models.crisis_event import CrisisLevel
from duyo.models.message import Message, MessageRole
from duyo.prompts import PARENT_REPORT_PROMPT
from duyo.services.gemini import get_client

log = logging.getLogger(__name__)

REPORT_WINDOW_DAYS = 10
# Cap how many child messages we feed the LLM (cost + latency bound).
_LLM_SAMPLE_LIMIT = 60


@dataclass
class ReportData:
    period_start: datetime
    period_end: datetime
    sections: dict
    llm_ok: bool


# ---------------------------------------------------------------------------
# Metric aggregate (code — no LLM)
# ---------------------------------------------------------------------------

async def _activity_section(
    session: AsyncSession, child_id: UUID, start: datetime, end: datetime
) -> dict:
    """Activity: active days, total child messages, conversations."""
    rows = (
        await session.execute(
            select(
                func.count(Message.id),
                func.count(func.distinct(func.date(Message.created_at))),
            )
            .join(Conversation, Message.conversation_id == Conversation.id)
            .where(
                Conversation.child_id == child_id,
                Message.role == MessageRole.CHILD,
                Message.created_at >= start,
                Message.created_at < end,
            )
        )
    ).one()
    total_messages, active_days = int(rows[0] or 0), int(rows[1] or 0)

    conv_count = await session.scalar(
        select(func.count(Conversation.id)).where(
            Conversation.child_id == child_id,
            Conversation.created_at >= start,
            Conversation.created_at < end,
        )
    )
    return {
        "active_days": active_days,
        "total_messages": total_messages,
        "conversations": int(conv_count or 0),
        "window_days": REPORT_WINDOW_DAYS,
    }


async def _safety_section(
    session: AsyncSession, child_id: UUID, start: datetime, end: datetime
) -> dict:
    """Stress/safety: count of non-GREEN crisis levels in the window.

    Parent-facing — exposes only counts, never the message text.
    """
    rows = (
        await session.execute(
            select(Message.crisis_level, func.count(Message.id))
            .join(Conversation, Message.conversation_id == Conversation.id)
            .where(
                Conversation.child_id == child_id,
                Message.role == MessageRole.CHILD,
                Message.created_at >= start,
                Message.created_at < end,
            )
            .group_by(Message.crisis_level)
        )
    ).all()
    by_level = {lvl.value: int(n) for lvl, n in rows}
    concerning = sum(
        by_level.get(lvl.value, 0)
        for lvl in (CrisisLevel.YELLOW, CrisisLevel.ORANGE, CrisisLevel.RED)
    )
    return {
        "by_level": by_level,
        "concerning_count": concerning,
        "had_red": by_level.get(CrisisLevel.RED.value, 0) > 0,
    }


async def _fetch_child_messages(
    session: AsyncSession, child_id: UUID, start: datetime, end: datetime
) -> list[str]:
    """Recent child message texts for the LLM pass (capped). Never returned."""
    rows = (
        await session.execute(
            select(Message.content)
            .join(Conversation, Message.conversation_id == Conversation.id)
            .where(
                Conversation.child_id == child_id,
                Message.role == MessageRole.CHILD,
                Message.created_at >= start,
                Message.created_at < end,
            )
            .order_by(Message.created_at.desc())
            .limit(_LLM_SAMPLE_LIMIT)
        )
    ).all()
    return [r[0] for r in rows]


# ---------------------------------------------------------------------------
# LLM mood/topic pass (one Gemini call)
# ---------------------------------------------------------------------------

_EMPTY_MOOD = {
    "mood_trend": "ma'lumot yetarli emas",
    "mood_summary": "Bu davrda tahlil uchun yetarli suhbat bo'lmadi.",
    "topics": [],
    "stress_signals": "",
    "highlight": "",
}


async def _mood_section(messages: list[str]) -> tuple[dict, bool]:
    """Run the single Gemini mood/topic pass. Returns (section, llm_ok).

    Fails SAFE: any error → metrics-only fallback (llm_ok=False), never raises.
    """
    if len(messages) < 3:
        return _EMPTY_MOOD, False

    settings = get_settings()
    # Newest first; number them so the model sees volume without quoting back.
    sample = "\n".join(f"- {m}" for m in messages)
    payload = (
        f"Bolaning so'nggi {len(messages)} ta xabari (namuna):\n{sample}\n\n"
        "Yuqoridagi qoidalarga amal qilib, JSON tahlil ber."
    )
    try:
        client = get_client()
        resp = await client.aio.models.generate_content(
            model=settings.gemini_model_primary,
            contents=payload,
            config=types.GenerateContentConfig(
                system_instruction=PARENT_REPORT_PROMPT,
                max_output_tokens=500,
                temperature=0.4,
                thinking_config=types.ThinkingConfig(
                    thinking_budget=settings.gemini_thinking_budget_flash
                ),
                response_mime_type="application/json",
            ),
        )
        data = json.loads((resp.text or "").strip())
        section = {
            "mood_trend": str(data.get("mood_trend", "aralash"))[:40],
            "mood_summary": str(data.get("mood_summary", ""))[:400],
            "topics": [str(t)[:40] for t in (data.get("topics") or [])][:6],
            "stress_signals": str(data.get("stress_signals", ""))[:300],
            "highlight": str(data.get("highlight", ""))[:300],
        }
        return section, True
    except Exception:
        log.exception("Parent report mood pass failed; using metrics-only")
        return _EMPTY_MOOD, False


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

async def build_report(
    session: AsyncSession, child_id: UUID, *, now: datetime, age: int = 10
) -> ReportData:
    """Build a fresh 10-day report for a child (no caching here — caller caches).

    `age` conditions the guidance tips (Concept §5). Defaults to 10 if the
    caller doesn't know it.
    """
    start = now - timedelta(days=REPORT_WINDOW_DAYS)

    activity = await _activity_section(session, child_id, start, now)
    safety = await _safety_section(session, child_id, start, now)
    messages = await _fetch_child_messages(session, child_id, start, now)
    mood, llm_ok = await _mood_section(messages)

    sections = {
        "activity": activity,
        "mood": mood,
        "safety": safety,
    }
    # Guidance (Concept §5) — actionable advice from the aggregate sections.
    # No raw messages are passed, preserving the §11.3 privacy contract.
    sections["guidance"] = await build_guidance(age, sections)

    return ReportData(
        period_start=start,
        period_end=now,
        sections=sections,
        llm_ok=llm_ok,
    )
