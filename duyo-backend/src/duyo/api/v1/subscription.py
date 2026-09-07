"""Subscription endpoints (Concept §12) — MOCK payment for MVP.

Tiers/limits are real (billing/tiers.py); subscription state is persisted.
Only the payment step is mocked: `subscribe` activates the plan immediately
with provider='mock' and no real charge. Click/Payme webhooks come later.

  GET  /subscriptions/plans     public tier catalogue (no auth)
  GET  /subscriptions/current   caller's subscription (auth)
  POST /subscriptions/subscribe activate a paid tier — MOCK (auth)
  POST /subscriptions/cancel    revert to free (auth)
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from duyo.api.deps import get_current_user, get_db
from duyo.billing import service, tiers
from duyo.core.config import get_settings
from duyo.models.subscription import Subscription
from duyo.models.user import User
from duyo.schemas.subscription import (
    SubscribeRequest,
    SubscriptionRead,
    TierInfo,
)

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])


@router.get("/plans", response_model=list[TierInfo])
async def list_plans() -> list[TierInfo]:
    """Public plan catalogue — no auth, drives the subscription screen."""
    return [TierInfo(**vars(t)) for t in tiers.all_tiers()]


@router.get("/current", response_model=SubscriptionRead)
async def current_subscription(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SubscriptionRead:
    """The plan as it stands TODAY.

    Reports what `billing/limits.py` will actually enforce. Returning the
    stored row unchanged would show a lapsed plan as still paid, so the screen
    would say premium while every message was counted against the free
    allowance — and the child would have no way to tell which was true.
    """
    sub = await service.get_or_create_subscription(db, current_user.id)
    return SubscriptionRead(
        tier=service.active_tier_key(sub.tier, sub.expires_at),
        status=sub.status,
        provider=sub.provider,
        started_at=sub.started_at,
        expires_at=sub.expires_at,
    )


@router.post("/subscribe", response_model=SubscriptionRead)
async def subscribe(
    payload: SubscribeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Subscription:
    """Activate a paid tier. MVP: payment is MOCKED — no real charge.

    Development only. For a real charge the client uses POST
    /payments/checkout (Click/Payme).
    """
    # Not in production, at any price. This route grants a paid tier with no
    # charge and rejects every provider EXCEPT the mock one, so on a live
    # server it is a free premium button for anyone who can send an
    # authenticated request. 404, not 403: a route that does not exist here
    # should not advertise that it exists somewhere.
    if get_settings().app_env == "production":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    if payload.provider != "mock":
        raise HTTPException(
            status.HTTP_501_NOT_IMPLEMENTED,
            f"Use /payments/checkout for provider '{payload.provider}'",
        )
    if not tiers.is_paid(payload.tier):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Not a paid tier")

    return await service.activate_subscription(
        db, current_user.id, payload.tier, payload.period, provider="mock",
    )


@router.post("/cancel", response_model=SubscriptionRead)
async def cancel(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Subscription:
    """Stop the plan renewing, keeping it until the paid period ends.

    Not an immediate revert: the confirmation dialog and terms.html §8 both
    say access lasts to the end of what was paid for, and the server used to
    take it away on the tap.
    """
    return await service.stop_renewal(db, current_user.id)
