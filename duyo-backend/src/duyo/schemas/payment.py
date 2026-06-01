"""Payment checkout schemas."""

from typing import Literal

from pydantic import BaseModel

BillingPeriod = Literal["monthly", "yearly"]
PaidTier = Literal["standart", "premium"]


class CheckoutRequest(BaseModel):
    """Start a real payment for a paid tier via Click or Payme."""

    tier: PaidTier
    period: BillingPeriod = "monthly"
    provider: Literal["click", "payme"]


class CheckoutResponse(BaseModel):
    order_id: str
    provider: str
    amount: int          # UZS so'm
    checkout_url: str
