"""Billing core — shared subscription activation + payment-order helpers.

Single source of truth for "a payment succeeded → activate the tier", reused by
the mock subscribe flow and by both real gateways (Click, Payme). Keeping this
here avoids drift between the three entry points.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from duyo.billing import tiers
from duyo.models.payment import Payment, PaymentProvider, PaymentState
from duyo.models.subscription import Subscription

PERIOD_DAYS: dict[str, int] = {"monthly": 30, "yearly": 365}


def amount_for(tier_key: str, period: str) -> int:
    """Price in UZS so'm for a tier/period. Raises ValueError for unknown input."""
    tier = tiers.get_tier(tier_key)
    if tier is None or not tiers.is_paid(tier_key):
        raise ValueError(f"Not a paid tier: {tier_key!r}")
    if period not in PERIOD_DAYS:
        raise ValueError(f"Unknown period: {period!r}")
    return tier.price_yearly if period == "yearly" else tier.price_monthly


async def get_or_create_subscription(db: AsyncSession, user_id: UUID) -> Subscription:
    sub = await db.scalar(select(Subscription).where(Subscription.user_id == user_id))
    if sub is None:
        sub = Subscription(user_id=user_id, tier=tiers.FREE, status="active")
        db.add(sub)
        await db.flush()
    return sub


async def activate_subscription(
    db: AsyncSession, user_id: UUID, tier: str, period: str, provider: str,
    *, now: datetime | None = None,
) -> Subscription:
    """Activate a paid tier for `period` days from now. Shared by all providers."""
    now = now or datetime.now(UTC)
    sub = await get_or_create_subscription(db, user_id)
    sub.tier = tier
    sub.status = "active"
    sub.provider = provider
    sub.started_at = now
    sub.expires_at = now + timedelta(days=PERIOD_DAYS.get(period, 30))
    await db.flush()
    return sub


async def revert_to_free(
    db: AsyncSession, user_id: UUID, *, only_if_tier: str | None = None,
) -> Subscription:
    """Revert a user to the free tier (cancel / refund).

    `only_if_tier` guards against a refund of an old order clobbering a newer
    plan: if the user has since moved to a different tier, leave it untouched.
    """
    sub = await get_or_create_subscription(db, user_id)
    if only_if_tier is not None and sub.tier != only_if_tier:
        return sub
    sub.tier = tiers.FREE
    sub.status = "active"
    sub.provider = None
    sub.started_at = None
    sub.expires_at = None
    await db.flush()
    return sub


async def create_payment(
    db: AsyncSession, user_id: UUID, tier: str, period: str, provider: PaymentProvider,
) -> Payment:
    """Create a PENDING payment order. `amount_for` validates tier/period."""
    payment = Payment(
        user_id=user_id,
        provider=provider,
        tier=tier,
        period=period,
        amount=amount_for(tier, period),
        state=PaymentState.PENDING,
    )
    db.add(payment)
    await db.flush()
    return payment


async def get_payment(
    db: AsyncSession, payment_id: str, *, for_update: bool = False,
) -> Payment | None:
    """Look up a payment by its order id (UUID string). Returns None if invalid.

    `for_update` takes a row lock so concurrent gateway webhook retries on the
    same order serialize instead of racing on the state transition.
    """
    try:
        pk = UUID(str(payment_id))
    except (ValueError, AttributeError):
        return None
    stmt = select(Payment).where(Payment.id == pk)
    if for_update:
        stmt = stmt.with_for_update()
    return await db.scalar(stmt)
