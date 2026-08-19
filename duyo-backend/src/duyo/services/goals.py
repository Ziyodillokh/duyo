"""Automatic goal + style-profile capture from conversation.

Runs as a BackgroundTask after a chat turn, never in the reply path, so it adds
zero latency and a failure here can never break a conversation. ONE Gemini
call (`INSIGHT_EXTRACT_PROMPT`) covers both signals a chat turn can carry —
a stated goal and a style/interest hint — because two small extractor calls
per turn would cost noticeably more than one combined call for barely more
signal. See `prompts.py::INSIGHT_EXTRACT_PROMPT` for the shared prompt and
`services/style_profile.py` for how the style half is merged.

Two safety properties matter more than recall on the goal side:

1. An extracted goal lands with `source=inferred` and `confirmed_at=NULL`, and
   `build_goal_context` only ever puts CONFIRMED goals in the system prompt.
   So DUYO cannot start talking about a goal it invented — the child confirms
   it first, from the Maqsadlar tab.
2. Progress updates are only ever applied to a goal the child already has.
   "10-betdaman" with no matching goal creates nothing.

The style side has its own, separate safety property (evidence voting, never
an overwrite) — that lives entirely in `style_profile.py`, which fails safe
on its own and is never allowed to raise into this module.
"""

from __future__ import annotations

import json
import re
from typing import Any
from uuid import UUID

import structlog
from google.genai import types
from sqlalchemy import select

from duyo.core.config import get_settings
from duyo.core.database import get_session_factory
from duyo.models.child import ChildProfile
from duyo.models.goal import (
    ChildGoal,
    ChildGoalEvent,
    GoalKind,
    GoalSource,
    GoalStatus,
)
from duyo.prompts import INSIGHT_EXTRACT_PROMPT
from duyo.services.gemini import get_client
from duyo.services.goal_matching import resolve_match_key
from duyo.services.goal_paths import decompose_goal_into_notes
from duyo.services.style_profile import merge_style_signal
from duyo.services.topic_notes import capture_topic

# structlog, not stdlib logging: the app configures no logging at all, so a
# stdlib logger's INFO lines never reach the container output. That is why a
# goal that failed to save left no trace anywhere — the code could not be
# diagnosed from production. Every module whose behaviour matters here
# (textbook/retriever, psychology/*) already uses structlog.
log = structlog.get_logger(__name__)

_TITLE_MAX = 60
#: Below this the utterance cannot carry a goal or style statement; skipping
#: saves a model call on every "ha", "rahmat", "zo'r".
_MIN_LEN = 12
_MAX_ACTIVE_GOALS = 12

#: An explicit "save this to my brain map" — the one short utterance that DOES
#: warrant a model call, because its content lives in the PRECEDING turns, not
#: in the message itself. Matched loosely (miya/xarita/eslab/saqla stems) so
#: "miyamga yoz", "xaritamga qo'shib qo'y", "buni eslab qol" all qualify.
_SAVE_COMMAND = re.compile(r"miya|xarita|eslab\s*qol|saqla", re.IGNORECASE)

#: How much of the conversation rides along to the extractor. Enough for
#: "buni yozib qo'y" to have a referent; small enough to stay cheap.
_CONTEXT_TURNS = 4
_CONTEXT_CHARS = 280


def _match_existing(goals: list[ChildGoal], title: str) -> ChildGoal | None:
    """Loose title match, so re-stating a goal updates instead of duplicating."""
    needle = title.casefold()
    for goal in goals:
        hay = goal.title.casefold()
        if needle in hay or hay in needle:
            return goal
    return None


def _context_block(history: list[tuple[str, str]] | None) -> str:
    """The tail of the conversation, compact, for the extractor to read.

    Without it, "buni miyamga yozib qo'y" has no referent — the content the
    child wants saved lives in the turns BEFORE the command. Kept to the last
    few turns and truncated per line so the extractor call stays cheap.
    """
    if not history:
        return ""
    lines = []
    for role, content in history[-_CONTEXT_TURNS:]:
        who = "Bola" if role == "user" else "DUYO"
        text = " ".join((content or "").split())[:_CONTEXT_CHARS]
        if text:
            lines.append(f"{who}: {text}")
    if not lines:
        return ""
    return "Oldingi suhbat:\n" + "\n".join(lines) + "\n\n"


async def _call_model(
    message: str, history: list[tuple[str, str]] | None = None
) -> dict[str, Any] | None:
    """One combined Gemini call for goal, style and topic signal.

    Returns the raw parsed JSON object, or None on any failure (bad JSON,
    network error, non-dict response) — callers decide what to do with a
    missing key, this function only guarantees "valid dict or nothing".
    """
    settings = get_settings()
    try:
        resp = await get_client().aio.models.generate_content(
            model=settings.gemini_model_primary,
            contents=f"{_context_block(history)}Bola aytdi: {message}",
            config=types.GenerateContentConfig(
                system_instruction=INSIGHT_EXTRACT_PROMPT,
                max_output_tokens=600,  # goal + style + topic share this budget
                temperature=0.0,  # extraction, not creativity
                thinking_config=types.ThinkingConfig(
                    thinking_budget=settings.gemini_thinking_budget_flash
                ),
                response_mime_type="application/json",
            ),
        )
        data = json.loads((resp.text or "").strip())
    except Exception:
        log.exception("insight_extract_failed")
        return None
    return data if isinstance(data, dict) else None


def _parse_goal(data: dict[str, Any]) -> dict[str, Any] | None:
    """Goal fields out of the combined response — None if there is no goal."""
    if not data.get("has_goal"):
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


async def _persist_goal(child_id: UUID, parsed: dict[str, Any]) -> tuple[UUID, str] | None:
    """DB half of goal capture — its own try/except so a failure here can
    never take the style merge down with it (they run independently).

    Returns (goal_id, title) only when a genuinely NEW goal was created, so
    the caller can decompose it into a brain-map path. Returns None for a
    progress update, a duplicate, the over-limit case, or any error — none of
    which should trigger a fresh decomposition.
    """
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
                return None

            # A child with a dozen open goals does not need DUYO inventing more.
            if len(active) >= _MAX_ACTIVE_GOALS:
                return None

            try:
                kind = GoalKind(parsed["kind"])
            except ValueError:
                kind = GoalKind.OTHER

            # Needed only to apply the catalogue's age band below.
            child_age = await session.scalar(
                select(ChildProfile.age).where(ChildProfile.id == child_id)
            )

            # Map the child's wording onto a published catalogue entry, if one
            # clearly fits. The key alone connects nobody: find_goal_mates
            # requires confirmed_at IS NOT NULL on BOTH sides, and an inferred
            # goal lands unconfirmed below — so this only takes effect once
            # the child has said yes to the goal in the Maqsadlar tab.
            match_key = None
            try:
                match_key = await resolve_match_key(
                    session, parsed["title"], age=child_age
                )
            except Exception:
                log.exception("goal_match_key_resolve_failed", child=str(child_id))

            unit_label = parsed["unit_label"]
            goal = ChildGoal(
                child_id=child_id,
                kind=kind,
                title=parsed["title"],
                match_key=match_key,
                status=GoalStatus.ACTIVE,
                source=GoalSource.INFERRED,
                confirmed_at=None,  # the child confirms before DUYO uses it
                unit_label=str(unit_label)[:24] if unit_label else None,
                total_units=_as_int(parsed["total_units"], ceiling=100_000),
                current_unit=progress,
            )
            session.add(goal)
            await session.commit()
            log.info("goal_inferred", child=str(child_id), title=parsed["title"])
            return goal.id, goal.title
    except Exception:
        log.exception("goal_persist_failed", child=str(child_id))
    return None


async def extract_child_insights(
    child_id: UUID,
    message: str,
    history: list[tuple[str, str]] | None = None,
) -> None:
    """Capture a goal (or progress), a style signal AND a topic — one call.

    The signals are then independent and each fails on its own — a
    goal-persistence error must never lose an already-computed style signal,
    and vice versa. `history` (the last few chat turns) gives short explicit
    commands like "buni miyamga yozib qo'y" their referent.
    """
    text = message.strip()
    # Too short to carry a signal — UNLESS it is an explicit save command,
    # whose content lives in the history, not the message.
    if len(text) < _MIN_LEN and not _SAVE_COMMAND.search(text):
        return

    data = await _call_model(message, history)
    if data is None:
        return

    # merge_style_signal already fails safe internally; this try/except is
    # defence in depth so a future change there can never take goal capture
    # down with it — the two halves must stay independent.
    try:
        await merge_style_signal(child_id, data.get("style"))
    except Exception:
        log.exception("style_merge_call_failed", child=str(child_id))

    # Third signal: a learning topic the child actually discussed becomes (or
    # enriches) a knowledge note in their brain map. Independent of the goal
    # half for the same reason the style half is.
    try:
        await capture_topic(child_id, data.get("topic"))
    except Exception:
        log.exception("topic_capture_call_failed", child=str(child_id))

    parsed = _parse_goal(data)
    if parsed is None:
        return
    created = await _persist_goal(child_id, parsed)

    # A genuinely new goal — break it into a path of linked notes in the
    # child's brain map. Own try/except inside; a failure there leaves the goal
    # un-mapped and never touches the goal row that was just saved.
    if created is not None:
        goal_id, goal_title = created
        await decompose_goal_into_notes(child_id, goal_id, goal_title)
