"""Subscription endpoints (Concept §12) — MOCK payment for MVP.

Tiers/limits are real (billing/tiers.py); subscription state is persisted.
Only the payment step is mocked: `subscribe` activates the plan immediately
with provider='mock' and no real charge. Click/Payme webhooks come later.

  GET  /subscriptions/plans     public tier catalogue (no auth)
  GET  /subscriptions/current   caller's subscription (auth)
  POST /subscriptions/subscribe activate a paid tier — MOCK (auth)
  POST /subscriptions/cancel    revert to free (auth)
"""

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from duyo.api.deps import get_current_user, get_db
from duyo.billing import tiers
from duyo.models.subscription import Subscription
from duyo.models.user import User
from duyo.schemas.subscription import (
    SubscribeRequest,
    SubscriptionRead,
    TierInfo,
)

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])

_MONTHLY_DAYS = 30
_YEARLY_DAYS = 365


async def _get_or_create(user_id, db: AsyncSession) -> Subscription:
    sub = await db.scalar(
        select(Subscription).where(Subscription.user_id == user_id)
    )
    if sub is None:
        sub = Subscription(user_id=user_id, tier=tiers.FREE, status="active")
        db.add(sub)
        await db.flush()
    return sub


@router.get("/plans", response_model=list[TierInfo])
async def list_plans() -> list[TierInfo]:
    """Public plan catalogue — no auth, drives the subscription screen."""
    return [TierInfo(**vars(t)) for t in tiers.all_tiers()]


@router.get("/current", response_model=SubscriptionRead)
async def current_subscription(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Subscription:
    return await _get_or_create(current_user.id, db)


@router.post("/subscribe", response_model=SubscriptionRead)
async def subscribe(
    payload: SubscribeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Subscription:
    """Activate a paid tier. MVP: payment is MOCKED — no real charge.

    Only provider='mock' is processed; real providers return 501 until the
    Click/Payme integration lands.
    """
    if payload.provider != "mock":
        raise HTTPException(
            status.HTTP_501_NOT_IMPLEMENTED,
            f"Payment provider '{payload.provider}' not yet integrated",
        )
    if not tiers.is_paid(payload.tier):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Not a paid tier")

    now = datetime.now(UTC)
    days = _YEARLY_DAYS if payload.period == "yearly" else _MONTHLY_DAYS

    sub = await _get_or_create(current_user.id, db)
    sub.tier = payload.tier
    sub.status = "active"
    sub.provider = "mock"
    sub.started_at = now
    sub.expires_at = now + timedelta(days=days)
    await db.flush()
    return sub


@router.post("/cancel", response_model=SubscriptionRead)
async def cancel(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Subscription:
    """Cancel the paid plan → revert to free immediately (MVP).

    (A grace period until expires_at is a future refinement.)
    """
    sub = await _get_or_create(current_user.id, db)
    sub.tier = tiers.FREE
    sub.status = "active"
    sub.provider = None
    sub.started_at = None
    sub.expires_at = None
    await db.flush()
    return sub
