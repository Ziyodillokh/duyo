"""Payment checkout schemas."""

from typing import Literal

from pydantic import BaseModel

BillingPeriod = Literal["monthly", "yearly"]
#: "standart" is retired but still accepted: a client built before the merge
#: may still send it, and rejecting it with a 422 would break checkout for
#: someone mid-upgrade. billing.tiers.get_tier maps it to the current plan.
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
