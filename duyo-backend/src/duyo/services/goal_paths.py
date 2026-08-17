"""Turn a detected goal into a path of linked notes in the child's brain map.

The bridge between the two halves that used to be unconnected: goal detection
(services/goals.py) and the Obsidian-style notes graph (models/note.py,
services/notes.py). When a new goal is inferred from chat, DUYO asks the model
to break it into an ordered path of small steps, then writes each step as a
ChildNote whose body links to the next with `[[...]]` — so the steps appear in
the Miya graph as a connected cluster leading to the goal.

Runs as a fire-and-forget continuation of the goal-extraction BackgroundTask:
its own session, its own try/except, and it fails to *nothing* (an un-mapped
goal), never to a half-written or wrong cluster.

Safety notes:
- The step text is DUYO-generated, not the child's, so it is NOT run through
  the crisis detector — Layer 1 screens a *child's* distress signals, and
  scanning our own conservative output would only manufacture false events.
  The real safeguard is the conservative, child-safe decomposition prompt.
- Everything written lands ONLY in this child's private graph. Nothing here is
  shared with peers (unlike a goal's match_key), so the prompt-injection
  surface is the child's own map — the same trust boundary as any note they
  type themselves.
- Idempotent by goal_id: a goal already decomposed is never decomposed again,
  so re-stating it in chat cannot duplicate the cluster.
"""

from __future__ import annotations

from uuid import UUID

import structlog
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from duyo.core.database import get_session_factory
from duyo.models.child import ChildProfile
from duyo.models.note import ChildNote, NoteSource
from duyo.services.gemini import decompose_goal

log = structlog.get_logger(__name__)

#: The goal cluster's reserved identity in the graph. The colour is DUYO's
#: gold; the tag lets the mobile galaxy colour the whole cluster as one (see
#: lib/galaxy-layout.ts) and lets the child filter their map to "my goals".
GOAL_COLOUR = "#FDC700"
GOAL_TAG = "#maqsad"
_TITLE_MAX = 120


def _uniquify(title: str, taken: set[str]) -> str:
    """A title unique among the child's notes, so a [[link]] resolves to one.

    Titles are unique per child (uq_note_child_title); an LLM step title may
    collide with a note the child already has. Suffix on collision, and record
    the result in `taken` so two generated steps can't collide with each other.
    """
    base = (title or "").strip()[:_TITLE_MAX] or "Maqsad"
    if base not in taken:
        taken.add(base)
        return base
    for i in range(2, 100):
        cand = f"{base[:_TITLE_MAX - 5]} ({i})"
        if cand not in taken:
            taken.add(cand)
            return cand
    taken.add(base)
    return base  # 99 collisions on one title is not a real scenario


def _build_path_notes(
    child_id: UUID, goal_id: UUID, goal_title: str,
    steps: list[dict[str, str]], taken: set[str],
) -> list[ChildNote]:
    """The hub goal note + one note per step, chained by [[links]].

    Final titles are resolved FIRST (against `taken`) so every body links to a
    title that will actually exist. Shape: hub -> 1-qadam -> 2-qadam -> ... ->
    last -> hub, so the cluster reads as a path that loops back to the goal.
    """
    hub_title = _uniquify(goal_title, taken)
    step_titles = [
        _uniquify(f"{i}-qadam: {s['title']}", taken)
        for i, s in enumerate(steps, start=1)
    ]

    notes: list[ChildNote] = [
        ChildNote(
            child_id=child_id, goal_id=goal_id, source=NoteSource.GOAL_PATH,
            title=hub_title, colour=GOAL_COLOUR,
            body=f"🎯 Maqsad. Bu yerdan boshla: [[{step_titles[0]}]]\n\n{GOAL_TAG}",
        )
    ]
    for i, (step, title) in enumerate(zip(steps, step_titles, strict=True)):
        is_last = i + 1 >= len(step_titles)
        nxt = hub_title if is_last else step_titles[i + 1]
        label = "Yakuniy maqsad" if is_last else "Keyingi qadam"
        notes.append(
            ChildNote(
                child_id=child_id, goal_id=goal_id, source=NoteSource.GOAL_PATH,
                title=title, colour=GOAL_COLOUR,
                body=f"{step['detail']}\n\n{label}: [[{nxt}]]\n\n{GOAL_TAG}",
            )
        )
    return notes


async def decompose_goal_into_notes(child_id: UUID, goal_id: UUID, goal_title: str) -> None:
    """Decompose a newly-detected goal into linked notes in the child's map.

    Best-effort: any failure logs and leaves the goal simply un-mapped. Never
    raises into the caller (the goal-extraction BackgroundTask).
    """
    try:
        session_factory = get_session_factory()

        # One short read: skip if already mapped, and get the age segment the
        # decomposition prompt needs + the titles to avoid colliding with.
        async with session_factory() as session:
            already = await session.scalar(
                select(ChildNote.id).where(ChildNote.goal_id == goal_id).limit(1)
            )
            if already is not None:
                return
            age_segment = await session.scalar(
                select(ChildProfile.age_segment).where(ChildProfile.id == child_id)
            )
            if age_segment is None:
                return
            taken = set(
                (
                    await session.scalars(
                        select(ChildNote.title).where(ChildNote.child_id == child_id)
                    )
                ).all()
            )

        # LLM call happens with no session held.
        steps = await decompose_goal(goal_title=goal_title, age_segment=age_segment)
        if not steps:
            return

        notes = _build_path_notes(child_id, goal_id, goal_title, steps, taken)

        async with session_factory() as session:
            # Re-check under the write session in case another turn raced us.
            already = await session.scalar(
                select(ChildNote.id).where(ChildNote.goal_id == goal_id).limit(1)
            )
            if already is not None:
                return
            session.add_all(notes)
            try:
                await session.commit()
            except IntegrityError:
                # A title collided despite _uniquify (a concurrent note write).
                # Drop the whole cluster rather than leave a broken path; the
                # goal stays un-mapped and nothing is corrupted.
                await session.rollback()
                log.warning("goal_path_title_conflict", child=str(child_id), goal=str(goal_id))
                return

        log.info(
            "goal_path_written", child=str(child_id), goal=str(goal_id), steps=len(notes) - 1
        )
    except Exception:
        log.exception("goal_path_failed", child=str(child_id), goal=str(goal_id))
