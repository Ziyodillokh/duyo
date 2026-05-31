"""Daily message-limit enforcement per subscription tier (Concept §12.1).

Free tier = 20 child messages/day; paid tiers = unlimited (daily_message_limit
is None). The limit is counted across ALL the parent's children for the
current UTC day, against the parent's subscription tier.

Resolves the tier with a get-or-create-free fallback so a user with no
subscription row is treated as free (the implicit default).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from duyo.billing import tiers
from duyo.models.child import ChildProfile
from duyo.models.conversation import Conversation
from duyo.models.message import Message, MessageRole
from duyo.models.subscription import Subscription


@dataclass(frozen=True)
class LimitStatus:
    allowed: bool
    limit: int | None   # None = unlimited
    used: int           # messages used today
    tier: str


async def _user_tier_key(session: AsyncSession, user_id: UUID) -> str:
    """Resolve the user's tier; missing subscription → free (implicit default)."""
    tier_key = await session.scalar(
        select(Subscription.tier).where(Subscription.user_id == user_id)
    )
    return tier_key or tiers.FREE


async def _messages_today(session: AsyncSession, user_id: UUID, now: datetime) -> int:
    """Count this parent's children's CHILD messages since UTC midnight."""
    day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    count = await session.scalar(
        select(func.count(Message.id))
        .select_from(Message)
        .join(Conversation, Message.conversation_id == Conversation.id)
        .join(ChildProfile, Conversation.child_id == ChildProfile.id)
        .where(
            ChildProfile.parent_id == user_id,
            Message.role == MessageRole.CHILD,
            Message.created_at >= day_start,
            Message.created_at < day_start + timedelta(days=1),
        )
    )
    return int(count or 0)


async def check_daily_message_limit(
    session: AsyncSession, user_id: UUID, *, now: datetime | None = None
) -> LimitStatus:
    """Return the daily-limit status for a parent. Does not raise.

    `allowed` is True when the tier is unlimited OR today's usage is below the
    limit. The endpoint decides what to do (e.g. 429) from this status.
    """
    now = now or datetime.now(UTC)
    tier_key = await _user_tier_key(session, user_id)
    tier = tiers.get_tier(tier_key) or tiers.get_tier(tiers.FREE)
    limit = tier.daily_message_limit

    if limit is None:
        return LimitStatus(allowed=True, limit=None, used=0, tier=tier_key)

    used = await _messages_today(session, user_id, now)
    return LimitStatus(allowed=used < limit, limit=limit, used=used, tier=tier_key)
