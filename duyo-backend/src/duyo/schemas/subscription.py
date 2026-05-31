"""Subscription request/response schemas (Concept §12)."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

BillingPeriod = Literal["monthly", "yearly"]
PaidTier = Literal["standart", "premium"]


class TierInfo(BaseModel):
    """One entry in the public plan catalogue (GET /subscriptions/plans)."""

    key: str
    name: str
    price_monthly: int
    price_yearly: int
    daily_message_limit: int | None
    ai_turns_per_day: int
    languages: int
    voice: bool
    max_children: int
    features: list[str]


class SubscriptionRead(BaseModel):
    tier: str
    status: str
    provider: str | None
    started_at: datetime | None
    expires_at: datetime | None

    model_config = {"from_attributes": True}


class SubscribeRequest(BaseModel):
    """Subscribe to a paid tier. Payment is MOCKED for MVP — no real charge.

    `period` sets the billing window (monthly/yearly). `provider` is accepted
    for forward-compat but only 'mock' is honoured until Click/Payme land.
    """

    tier: PaidTier
    period: BillingPeriod = "monthly"
    provider: Literal["mock", "click", "payme"] = Field(
        default="mock", description="MVP: only 'mock' is processed",
    )
