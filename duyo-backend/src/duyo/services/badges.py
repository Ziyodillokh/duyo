"""The badge that stands beside a peer's name — computed for many at once.

## Why this is not just a call to the achievements endpoint

Achievements are derived, never stored (see gamification/achievements.py), so
"what badge does this child wear" is three aggregate queries, not a column.
Answering it one child at a time is fine for the achievements page, which asks
about exactly one child; it is three queries per row on a goal-mates list.

So this module answers for a SET of children in three queries total,
regardless of how many are in it. Every caller with more than one peer in hand
must use `badges_for`; `badge_for` is the single-child convenience and is
itself just a set of one.

## Why it returns keys and not artwork

The client owns the badge art. This returns achievement keys — the same
vocabulary /achievements already speaks — so redrawing a badge is a client
release and nothing here changes.
"""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from duyo.gamification.achievements import compute_achievements, top_badge
from duyo.gamification.levels import level_info
from duyo.models.conversation import Conversation
from duyo.models.gamification import BallsTransaction, Streak
from duyo.models.message import Message, MessageRole


async def badges_for(
    session: AsyncSession, child_ids: list[UUID]
) -> dict[UUID, str | None]:
    """Map every given child to their rarest earned badge key (or None).

    Every id passed in is present in the result. A child with no ledger, no
    streak row and no messages is a legitimate answer of None, not a missing
    key the caller has to guard against.
    """
    ids = list(dict.fromkeys(child_ids))  # de-duplicated, order irrelevant
    if not ids:
        return {}

    balances = dict(
        (
            await session.execute(
                select(
                    BallsTransaction.child_id,
                    func.coalesce(func.sum(BallsTransaction.amount), 0),
                )
                .where(BallsTransaction.child_id.in_(ids))
                .group_by(BallsTransaction.child_id)
            )
        ).all()
    )

    streaks = dict(
        (
            await session.execute(
                select(Streak.child_id, Streak.longest_streak).where(
                    Streak.child_id.in_(ids)
                )
            )
        ).all()
    )

    # Counted the same way the achievements endpoint counts: the CHILD's own
    # messages only. Counting DUYO's replies too would hand out "50 messages"
    # to a child who wrote 25.
    counts = dict(
        (
            await session.execute(
                select(Conversation.child_id, func.count(Message.id))
                .join(Message, Message.conversation_id == Conversation.id)
                .where(
                    Conversation.child_id.in_(ids),
                    Message.role == MessageRole.CHILD,
                )
                .group_by(Conversation.child_id)
            )
        ).all()
    )

    out: dict[UUID, str | None] = {}
    for child_id in ids:
        achievements = compute_achievements(
            level=level_info(int(balances.get(child_id, 0) or 0)).level,
            longest_streak=int(streaks.get(child_id, 0) or 0),
            message_count=int(counts.get(child_id, 0) or 0),
        )
        out[child_id] = top_badge(achievements)
    return out


async def badge_for(session: AsyncSession, child_id: UUID) -> str | None:
    """One child's badge. A set of one — see the module docstring."""
    return (await badges_for(session, [child_id])).get(child_id)
