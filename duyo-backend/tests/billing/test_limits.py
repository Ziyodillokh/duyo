"""Daily message-limit tests (Concept §12.1)."""

import asyncio
from dataclasses import dataclass, field
from datetime import UTC, datetime
from uuid import uuid4

from duyo.billing import limits, tiers


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


@dataclass
class _Row:
    row: tuple | None

    def first(self):
        return self.row


@dataclass
class _FakeSession:
    """The subscription lookup, then the message count.

    `execute()` answers the first — it reads tier AND expires_at together,
    because a tier read without its expiry is what let a one-month purchase
    last forever. `scalar()` answers the second.
    """

    scalar_queue: list = field(default_factory=list)
    #: (tier, expires_at), or None for "no subscription row".
    subscription: tuple | None = None

    async def execute(self, *_a, **_kw):
        return _Row(self.subscription)

    async def scalar(self, *_a, **_kw):
        return self.scalar_queue.pop(0)


_NOW = datetime(2026, 6, 1, 12, 0, tzinfo=UTC)


def test_free_under_limit_allowed():
    # scalar #1 → tier 'free'; scalar #2 → used today = 5
    db = _FakeSession(subscription=("free", None), scalar_queue=[5])
    st = _run(limits.check_daily_message_limit(db, uuid4(), now=_NOW))
    assert st.allowed is True
    assert st.limit == 20 and st.used == 5 and st.tier == "free"


def test_free_at_limit_blocked():
    db = _FakeSession(subscription=("free", None), scalar_queue=[20])  # used == limit
    st = _run(limits.check_daily_message_limit(db, uuid4(), now=_NOW))
    assert st.allowed is False
    assert st.used == 20 and st.limit == 20


def test_free_over_limit_blocked():
    db = _FakeSession(subscription=("free", None), scalar_queue=[25])
    st = _run(limits.check_daily_message_limit(db, uuid4(), now=_NOW))
    assert st.allowed is False


def test_retired_tier_gets_the_current_plans_limit():
    """A subscriber still stored as "standart" is counted against the plan
    that replaced it, not dropped to free."""
    db = _FakeSession(subscription=(tiers.STANDART, None), scalar_queue=[7])
    st = _run(limits.check_daily_message_limit(db, uuid4(), now=_NOW))
    assert st.allowed is True
    assert st.limit == 100 and st.tier == "standart"


def test_paid_tier_is_bounded_not_unlimited():
    """Paid was daily_message_limit=None, so usage was never counted. The
    single tier has a real ceiling, which is what makes one account's cost
    knowable."""
    db = _FakeSession(subscription=(tiers.PREMIUM, None), scalar_queue=[42])
    st = _run(limits.check_daily_message_limit(db, uuid4(), now=_NOW))
    assert st.allowed is True
    assert st.limit == 100 and st.used == 42


def test_paid_tier_refuses_past_its_ceiling():
    db = _FakeSession(subscription=(tiers.PREMIUM, None), scalar_queue=[100])
    st = _run(limits.check_daily_message_limit(db, uuid4(), now=_NOW))
    assert st.allowed is False


def test_missing_subscription_defaults_to_free():
    # scalar #1 → None (no subscription row) → treated as free; #2 → used 3
    db = _FakeSession(subscription=None, scalar_queue=[3])
    st = _run(limits.check_daily_message_limit(db, uuid4(), now=_NOW))
    assert st.tier == "free"
    assert st.limit == 20 and st.allowed is True


# ── expiry ────────────────────────────────────────────────────────────────────
#
# `expires_at` was written by every activation and read by nothing, so a paid
# plan never lapsed: one month's payment bought the tier permanently. These
# pin the clock into the decision.


def test_a_paid_plan_past_its_date_is_worth_the_free_tier():
    expired = datetime(2026, 5, 1, tzinfo=UTC)
    db = _FakeSession(subscription=(tiers.PREMIUM, expired), scalar_queue=[5])
    st = _run(limits.check_daily_message_limit(db, uuid4(), now=_NOW))
    assert st.tier == tiers.FREE
    assert st.limit == 20


def test_a_paid_plan_inside_its_date_still_counts():
    live = datetime(2026, 7, 1, tzinfo=UTC)
    db = _FakeSession(subscription=(tiers.PREMIUM, live), scalar_queue=[5])
    st = _run(limits.check_daily_message_limit(db, uuid4(), now=_NOW))
    assert st.tier == tiers.PREMIUM
    assert st.limit == 100


def test_the_boundary_moment_has_already_expired():
    """expires_at IS the end of the period, not a moment still inside it."""
    db = _FakeSession(subscription=(tiers.PREMIUM, _NOW), scalar_queue=[5])
    st = _run(limits.check_daily_message_limit(db, uuid4(), now=_NOW))
    assert st.tier == tiers.FREE


def test_a_paid_tier_with_no_expiry_is_a_grant_and_keeps_working():
    """Set by hand or by the mock activation path — deliberately not expired."""
    db = _FakeSession(subscription=(tiers.PREMIUM, None), scalar_queue=[5])
    st = _run(limits.check_daily_message_limit(db, uuid4(), now=_NOW))
    assert st.tier == tiers.PREMIUM
