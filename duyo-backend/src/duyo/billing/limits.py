"""Daily ceilings per subscription tier (Concept §12.1).

Two of them, counted the same way — across ALL the parent's children, for the
current UTC day, against the parent's tier:

    messages   free 20/day, paid 100/day
    voice      free FREE_DAILY_VOICE_TURNS spoken turns/day, paid unlimited

Voice was not a ceiling before; it was a wall. The free plan had `voice=False`
and the socket was refused, so a child was asked to pay for the one feature
they had never heard. It is a quota now: enough to find out what it is, not
enough to live on.

Both resolve the tier with a get-or-create-free fallback, so a user with no
subscription row is treated as free (the implicit default).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from duyo.billing import service, tiers
from duyo.models.child import ChildProfile
from duyo.models.conversation import Conversation
from duyo.models.message import MODALITY_VOICE, Message, MessageRole
from duyo.models.subscription import Subscription


@dataclass(frozen=True)
class LimitStatus:
    allowed: bool
    limit: int | None   # None = unlimited
    used: int           # messages used today
    tier: str


async def _user_tier_key(session: AsyncSession, user_id: UUID, now: datetime) -> str:
    """Resolve the user's tier; missing subscription → free (implicit default).

    Goes through `active_tier_key` so an EXPIRED paid plan counts as free.
    Reading `Subscription.tier` alone is what made a one-month purchase last
    forever.
    """
    row = (
        await session.execute(
            select(Subscription.tier, Subscription.expires_at).where(
                Subscription.user_id == user_id
            )
        )
    ).first()
    if row is None:
        return tiers.FREE
    return service.active_tier_key(row[0], row[1], now=now)


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


async def active_tier_key_for_user(session: AsyncSession, user_id: UUID, *, now: datetime | None = None) -> str:
    """The tier this user's plan confers right now — expiry included.

    Public because the voice gate needs the same answer the daily limit uses,
    and two ways of asking would be two answers waiting to disagree.
    """
    return await _user_tier_key(session, user_id, now or datetime.now(UTC))

async def check_daily_message_limit(
    session: AsyncSession, user_id: UUID, *, now: datetime | None = None
) -> LimitStatus:
    """Return the daily-limit status for a parent. Does not raise.

    `allowed` is True when the tier is unlimited OR today's usage is below the
    limit. The endpoint decides what to do (e.g. 429) from this status.
    """
    now = now or datetime.now(UTC)
    tier_key = await _user_tier_key(session, user_id, now)
    tier = tiers.get_tier(tier_key) or tiers.get_tier(tiers.FREE)
    limit = tier.daily_message_limit

    if limit is None:
        return LimitStatus(allowed=True, limit=None, used=0, tier=tier_key)

    used = await _messages_today(session, user_id, now)
    return LimitStatus(allowed=used < limit, limit=limit, used=used, tier=tier_key)


async def _voice_turns_today(session: AsyncSession, user_id: UUID, now: datetime) -> int:
    """Count this parent's children's SPOKEN turns since UTC midnight.

    One turn writes one CHILD row and one ASSISTANT row, both stamped
    MODALITY_VOICE; counting the child side makes one turn cost one.
    """
    day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    count = await session.scalar(
        select(func.count(Message.id))
        .select_from(Message)
        .join(Conversation, Message.conversation_id == Conversation.id)
        .join(ChildProfile, Conversation.child_id == ChildProfile.id)
        .where(
            ChildProfile.parent_id == user_id,
            Message.role == MessageRole.CHILD,
            Message.modality == MODALITY_VOICE,
            Message.created_at >= day_start,
            Message.created_at < day_start + timedelta(days=1),
        )
    )
    return int(count or 0)


async def check_daily_voice_limit(
    session: AsyncSession, user_id: UUID, *, now: datetime | None = None
) -> LimitStatus:
    """Return the spoken-turn status for a parent. Does not raise.

    Voice is available on every tier now; what separates them is how much.
    Free gets `FREE_DAILY_VOICE_TURNS` a day, paid is unlimited.

    `allowed` is False in two different situations the caller must tell apart,
    which is why the tier comes back with it:

      tier.voice is False   the plan has no voice at all (no such plan today,
                            but the flag is still read rather than assumed)
      used >= limit         the plan has voice and today's is spent

    A child who has run out is not being sold anything they cannot have — they
    can talk again tomorrow — so the endpoint says which of the two happened.
    """
    now = now or datetime.now(UTC)
    tier_key = await _user_tier_key(session, user_id, now)
    tier = tiers.get_tier(tier_key) or tiers.get_tier(tiers.FREE)

    if not tier.voice:
        return LimitStatus(allowed=False, limit=0, used=0, tier=tier_key)

    limit = tier.daily_voice_turns
    if limit is None:
        return LimitStatus(allowed=True, limit=None, used=0, tier=tier_key)

    used = await _voice_turns_today(session, user_id, now)
    return LimitStatus(allowed=used < limit, limit=limit, used=used, tier=tier_key)
