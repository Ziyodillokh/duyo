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
) -> Subscription:
    return await service.get_or_create_subscription(db, current_user.id)


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
    """Cancel the paid plan → revert to free immediately (MVP).

    (A grace period until expires_at is a future refinement.)
    """
    return await service.revert_to_free(db, current_user.id)
