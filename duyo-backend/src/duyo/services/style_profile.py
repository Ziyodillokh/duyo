"""Style profile — evidence-based merging of `INSIGHT_EXTRACT_PROMPT`'s "style" object.

This is NOT psychology. It never labels a child (introvert, anxious, gifted —
none of that vocabulary exists here); it only accumulates votes on how DUYO
should TALK to them: shorter or longer replies, more or less humor, whether
they tend to need encouragement, and short interest/avoid-topic tags. The
`psychology/` module (clinically unvalidated per HOLAT-2026-08-01.md §5) and
this module must stay separate — if a future change wants this profile to
inform anything diagnostic, that is a pedagogical/clinical review decision,
not a code change.

Every call is one message's worth of evidence, added to a counter — never an
overwrite. A single sarcastic reply or one bad day cannot repaint how DUYO
treats a child; a trait only becomes visible to `personalization.py` once it
has repeated (see `_CONFIDENCE_FLOOR`). This mirrors why `child_goals` needs
`confirmed_at` before DUYO acts on a goal it merely inferred.

Called from `services/goals.py` as part of the SAME background task/model
call that already extracts goals — see `prompts.py::INSIGHT_EXTRACT_PROMPT`.
Deliberately not its own LLM call: two small model calls per turn cost more
than one combined call for barely more signal.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

import structlog
from sqlalchemy import select

from duyo.core.database import get_session_factory
from duyo.models.child_style import ChildStyleProfile

log = structlog.get_logger(__name__)

#: A trait needs at least this many agreeing votes before personalization.py
#: will mention it — one message is an anecdote, not a pattern.
CONFIDENCE_FLOOR = 2

_VALID_LENGTH = {"short", "medium", "long"}
_VALID_HUMOR = {"low", "medium", "high"}
_TAG_MAX = 30
#: Caps how many distinct tags a profile accumulates. Once exceeded, the
#: least-voted tag is dropped — recent/repeated interests matter more than
#: an ever-growing bag nobody prunes.
_MAX_TAGS = 20
_MAX_TAGS_PER_MESSAGE = 3


def _clean_tag(raw: str) -> str | None:
    """Lowercase, collapse whitespace/newlines, cap length. None if empty."""
    tag = " ".join(str(raw).split()).strip().lower()[:_TAG_MAX]
    return tag or None


def _bump(votes: dict[str, int] | None, key: str) -> dict[str, int]:
    votes = dict(votes) if votes else {}  # don't mutate the ORM-tracked dict in place
    votes[key] = votes.get(key, 0) + 1
    return votes


def _bump_tags(counts: dict[str, int] | None, tags: list[Any]) -> dict[str, int]:
    counts = dict(counts) if counts else {}
    for raw in tags[:_MAX_TAGS_PER_MESSAGE]:
        tag = _clean_tag(raw) if isinstance(raw, str) else None
        if tag:
            counts[tag] = counts.get(tag, 0) + 1
    if len(counts) > _MAX_TAGS:
        # Keep the highest-voted _MAX_TAGS; ties broken arbitrarily, which is
        # fine — this is a soft cap, not a ranking guarantee.
        keep = sorted(counts.items(), key=lambda kv: kv[1], reverse=True)[:_MAX_TAGS]
        counts = dict(keep)
    return counts


def dominant(votes: dict[str, int]) -> str | None:
    """The leading key, or None if there is no vote or a tie at the top.

    A tie means the signal is genuinely mixed — surfacing either side would
    be a coin flip dressed up as a fact about the child.
    """
    if not votes:
        return None
    ranked = sorted(votes.items(), key=lambda kv: kv[1], reverse=True)
    if len(ranked) > 1 and ranked[0][1] == ranked[1][1]:
        return None
    return ranked[0][0]


def confident(votes: dict[str, int]) -> str | None:
    """`dominant`, gated by `CONFIDENCE_FLOOR` — one vote is an anecdote.

    This is the function `personalization.py` calls before it ever lets a
    trait reach the system prompt.
    """
    top = dominant(votes)
    if top is None or votes.get(top, 0) < CONFIDENCE_FLOOR:
        return None
    return top


def top_tags(counts: dict[str, int], *, limit: int) -> list[str]:
    """Tags with at least `CONFIDENCE_FLOOR` mentions, most-mentioned first."""
    ranked = sorted(
        (tag for tag, n in counts.items() if n >= CONFIDENCE_FLOOR),
        key=lambda tag: counts[tag],
        reverse=True,
    )
    return ranked[:limit]


async def merge_style_signal(child_id: UUID, style: dict[str, Any] | None) -> None:
    """Fold one message's style/interest signal into the child's profile.

    Opens its own session — called from a BackgroundTask, whose caller's
    session is already closed by the time this runs (same reasoning as
    `services/goals.py::extract_goal_candidate`). Fails safe: never raises,
    so a persistence problem here can never surface as a broken chat turn.
    """
    if not style or not isinstance(style, dict):
        return

    length_pref = style.get("length_pref")
    humor_pref = style.get("humor_pref")
    needs_encouragement = style.get("needs_encouragement")
    interests = style.get("interests") or []
    avoid_topics = style.get("avoid_topics") or []

    has_signal = (
        length_pref in _VALID_LENGTH
        or humor_pref in _VALID_HUMOR
        or isinstance(needs_encouragement, bool)
        or bool(interests)
        or bool(avoid_topics)
    )
    if not has_signal:
        return

    try:
        session_factory = get_session_factory()
        async with session_factory() as session:
            profile = await session.scalar(
                select(ChildStyleProfile).where(ChildStyleProfile.child_id == child_id)
            )
            if profile is None:
                # `default=dict` on the model only applies at INSERT time, not
                # to the Python object before it is flushed — the merge logic
                # below reads/writes these dicts immediately, so they must be
                # real (empty) dicts here, not None.
                profile = ChildStyleProfile(
                    child_id=child_id,
                    length_votes={}, humor_votes={}, encouragement_votes={},
                    interests={}, avoid_topics={}, evidence_count=0,
                )
                session.add(profile)

            if length_pref in _VALID_LENGTH:
                profile.length_votes = _bump(profile.length_votes, length_pref)
            if humor_pref in _VALID_HUMOR:
                profile.humor_votes = _bump(profile.humor_votes, humor_pref)
            if isinstance(needs_encouragement, bool):
                profile.encouragement_votes = _bump(
                    profile.encouragement_votes, "yes" if needs_encouragement else "no"
                )
            if interests:
                profile.interests = _bump_tags(profile.interests, interests)
            if avoid_topics:
                profile.avoid_topics = _bump_tags(profile.avoid_topics, avoid_topics)

            profile.evidence_count += 1
            await session.commit()
            log.info("style_signal_merged", child=str(child_id),
                      evidence=profile.evidence_count)
    except Exception:
        log.exception("style_signal_merge_failed", child=str(child_id))
