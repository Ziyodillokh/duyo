"""Automatic goal capture from conversation.

Runs as a BackgroundTask after a chat turn, never in the reply path, so it adds
zero latency and a failure here can never break a conversation.

Two safety properties matter more than recall:

1. An extracted goal lands with `source=inferred` and `confirmed_at=NULL`, and
   `build_goal_context` only ever puts CONFIRMED goals in the system prompt.
   So DUYO cannot start talking about a goal it invented — the child confirms
   it first, from the Maqsadlar tab.
2. Progress updates are only ever applied to a goal the child already has.
   "10-betdaman" with no matching goal creates nothing.
"""

from __future__ import annotations

import json
from uuid import UUID

import structlog
from google.genai import types
from sqlalchemy import select

from duyo.core.config import get_settings
from duyo.core.database import get_session_factory
from duyo.models.goal import (
    ChildGoal,
    ChildGoalEvent,
    GoalKind,
    GoalSource,
    GoalStatus,
)
from duyo.prompts import GOAL_EXTRACT_PROMPT
from duyo.services.gemini import get_client

# structlog, not stdlib logging: the app configures no logging at all, so a
# stdlib logger's INFO lines never reach the container output. That is why a
# goal that failed to save left no trace anywhere — the code could not be
# diagnosed from production. Every module whose behaviour matters here
# (textbook/retriever, psychology/*) already uses structlog.
log = structlog.get_logger(__name__)

_TITLE_MAX = 60
#: Below this the utterance cannot carry a goal statement; skipping saves a
#: model call on every "ha", "rahmat", "zo'r".
_MIN_LEN = 12
_MAX_ACTIVE_GOALS = 12


def _match_existing(goals: list[ChildGoal], title: str) -> ChildGoal | None:
    """Loose title match, so re-stating a goal updates instead of duplicating."""
    needle = title.casefold()
    for goal in goals:
        hay = goal.title.casefold()
        if needle in hay or hay in needle:
            return goal
    return None


async def _extract(question: str) -> dict | None:
    settings = get_settings()
    try:
        resp = await get_client().aio.models.generate_content(
            model=settings.gemini_model_primary,
            contents=f"Bola aytdi: {question}",
            config=types.GenerateContentConfig(
                system_instruction=GOAL_EXTRACT_PROMPT,
                max_output_tokens=300,
                temperature=0.0,  # extraction, not creativity
                thinking_config=types.ThinkingConfig(
                    thinking_budget=settings.gemini_thinking_budget_flash
                ),
                response_mime_type="application/json",
            ),
        )
        data = json.loads((resp.text or "").strip())
    except Exception:
        log.exception("goal_extract_failed")
        return None

    if not isinstance(data, dict) or not data.get("has_goal"):
        return None
    title = str(data.get("title", "")).strip()[:_TITLE_MAX]
    if len(title) < 3:
        return None
    return {
        "title": " ".join(title.split()),
        "kind": str(data.get("kind", "other")),
        "unit_label": data.get("unit_label"),
        "total_units": data.get("total_units"),
        "progress_value": data.get("progress_value"),
    }


def _as_int(value: object, *, ceiling: int) -> int | None:
    try:
        number = int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None
    return number if 0 <= number <= ceiling else None


async def extract_goal_candidate(child_id: UUID, message: str) -> None:
    """Capture a goal (or progress on one) the child just mentioned.

    Opens its own session: the request's session is closed by the time a
    BackgroundTask runs.
    """
    if len(message.strip()) < _MIN_LEN:
        return

    parsed = await _extract(message)
    if parsed is None:
        return

    try:
        session_factory = get_session_factory()
        async with session_factory() as session:
            result = await session.execute(
                select(ChildGoal).where(
                    ChildGoal.child_id == child_id,
                    ChildGoal.status == GoalStatus.ACTIVE,
                )
            )
            active = list(result.scalars().all())

            progress = _as_int(parsed["progress_value"], ceiling=100_000)
            existing = _match_existing(active, parsed["title"])

            if existing is not None:
                # Only ever advance progress on a goal the child already has.
                if progress is not None and (
                    existing.current_unit is None or progress > existing.current_unit
                ):
                    session.add(
                        ChildGoalEvent(
                            goal_id=existing.id,
                            child_id=child_id,
                            unit_value=progress,
                            note=None,
                            source=GoalSource.INFERRED,
                        )
                    )
                    existing.current_unit = progress
                    if existing.total_units:
                        existing.progress_pct = round(
                            min(100.0, progress / existing.total_units * 100), 1
                        )
                    await session.commit()
                    log.info("goal_progress_inferred", child=str(child_id),
                             goal=str(existing.id), unit=progress)
                return

            # A child with a dozen open goals does not need DUYO inventing more.
            if len(active) >= _MAX_ACTIVE_GOALS:
                return

            try:
                kind = GoalKind(parsed["kind"])
            except ValueError:
                kind = GoalKind.OTHER

            unit_label = parsed["unit_label"]
            session.add(
                ChildGoal(
                    child_id=child_id,
                    kind=kind,
                    title=parsed["title"],
                    match_key=None,  # catalogue mapping is a curation step
                    status=GoalStatus.ACTIVE,
                    source=GoalSource.INFERRED,
                    confirmed_at=None,  # the child confirms before DUYO uses it
                    unit_label=str(unit_label)[:24] if unit_label else None,
                    total_units=_as_int(parsed["total_units"], ceiling=100_000),
                    current_unit=progress,
                )
            )
            await session.commit()
            log.info("goal_inferred", child=str(child_id), title=parsed["title"])
    except Exception:
        log.exception("goal_persist_failed", child=str(child_id))
