"""Daily message-limit tests (Concept §12.1)."""

import asyncio
from dataclasses import dataclass, field
from datetime import UTC, datetime
from uuid import uuid4

from duyo.billing import limits, tiers


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


@dataclass
class _FakeSession:
    """scalar() returns queued values in call order."""
    scalar_queue: list = field(default_factory=list)

    async def scalar(self, *_a, **_kw):
        return self.scalar_queue.pop(0)


_NOW = datetime(2026, 6, 1, 12, 0, tzinfo=UTC)


def test_free_under_limit_allowed():
    # scalar #1 → tier 'free'; scalar #2 → used today = 5
    db = _FakeSession(scalar_queue=["free", 5])
    st = _run(limits.check_daily_message_limit(db, uuid4(), now=_NOW))
    assert st.allowed is True
    assert st.limit == 20 and st.used == 5 and st.tier == "free"


def test_free_at_limit_blocked():
    db = _FakeSession(scalar_queue=["free", 20])  # used == limit
    st = _run(limits.check_daily_message_limit(db, uuid4(), now=_NOW))
    assert st.allowed is False
    assert st.used == 20 and st.limit == 20


def test_free_over_limit_blocked():
    db = _FakeSession(scalar_queue=["free", 25])
    st = _run(limits.check_daily_message_limit(db, uuid4(), now=_NOW))
    assert st.allowed is False


def test_retired_tier_gets_the_current_plans_limit():
    """A subscriber still stored as "standart" is counted against the plan
    that replaced it, not dropped to free."""
    db = _FakeSession(scalar_queue=[tiers.STANDART, 7])
    st = _run(limits.check_daily_message_limit(db, uuid4(), now=_NOW))
    assert st.allowed is True
    assert st.limit == 100 and st.tier == "standart"


def test_paid_tier_is_bounded_not_unlimited():
    """Paid was daily_message_limit=None, so usage was never counted. The
    single tier has a real ceiling, which is what makes one account's cost
    knowable."""
    db = _FakeSession(scalar_queue=[tiers.PREMIUM, 42])
    st = _run(limits.check_daily_message_limit(db, uuid4(), now=_NOW))
    assert st.allowed is True
    assert st.limit == 100 and st.used == 42


def test_paid_tier_refuses_past_its_ceiling():
    db = _FakeSession(scalar_queue=[tiers.PREMIUM, 100])
    st = _run(limits.check_daily_message_limit(db, uuid4(), now=_NOW))
    assert st.allowed is False


def test_missing_subscription_defaults_to_free():
    # scalar #1 → None (no subscription row) → treated as free; #2 → used 3
    db = _FakeSession(scalar_queue=[None, 3])
    st = _run(limits.check_daily_message_limit(db, uuid4(), now=_NOW))
    assert st.tier == "free"
    assert st.limit == 20 and st.allowed is True
