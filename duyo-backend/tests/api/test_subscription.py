"""Subscription endpoint tests — plans, current, subscribe (mock), cancel."""

import asyncio
from dataclasses import dataclass, field
from datetime import UTC
from uuid import uuid4

import pytest
from fastapi import HTTPException

from duyo.api.v1 import subscription as sub_api
from duyo.billing import tiers
from duyo.models.subscription import Subscription
from duyo.schemas.subscription import SubscribeRequest


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


@dataclass
class _FakeSession:
    scalars_queue: list = field(default_factory=list)
    added: list = field(default_factory=list)
    flushed: bool = False

    async def scalar(self, *_a, **_kw):
        return self.scalars_queue.pop(0)

    def add(self, obj):
        self.added.append(obj)

    async def flush(self):
        self.flushed = True


@dataclass
class _User:
    id: object


# ── Plans (public) ───────────────────────────────────────────────────────────

def test_list_plans_returns_three_tiers():
    plans = _run(sub_api.list_plans())
    assert [p.key for p in plans] == ["free", "standart", "premium"]
    assert plans[2].voice is True


# ── Current (get-or-create) ──────────────────────────────────────────────────

def test_current_creates_free_when_missing():
    user = _User(uuid4())
    db = _FakeSession(scalars_queue=[None])
    sub = _run(sub_api.current_subscription(current_user=user, db=db))
    assert sub.tier == tiers.FREE
    assert db.added and isinstance(db.added[0], Subscription)


def test_current_returns_existing():
    user = _User(uuid4())
    existing = Subscription(user_id=user.id, tier="premium", status="active")
    db = _FakeSession(scalars_queue=[existing])
    sub = _run(sub_api.current_subscription(current_user=user, db=db))
    assert sub.tier == "premium"
    assert db.added == []


# ── Subscribe (mock) ─────────────────────────────────────────────────────────

def test_subscribe_mock_activates_paid_tier():
    user = _User(uuid4())
    existing = Subscription(user_id=user.id, tier="free", status="active")
    db = _FakeSession(scalars_queue=[existing])
    sub = _run(sub_api.subscribe(
        payload=SubscribeRequest(tier="standart", period="monthly", provider="mock"),
        current_user=user, db=db,
    ))
    assert sub.tier == "standart"
    assert sub.status == "active"
    assert sub.provider == "mock"
    assert sub.started_at is not None
    assert sub.expires_at is not None
    assert (sub.expires_at - sub.started_at).days == 30


def test_subscribe_yearly_sets_365_day_window():
    user = _User(uuid4())
    existing = Subscription(user_id=user.id, tier="free", status="active")
    db = _FakeSession(scalars_queue=[existing])
    sub = _run(sub_api.subscribe(
        payload=SubscribeRequest(tier="premium", period="yearly", provider="mock"),
        current_user=user, db=db,
    ))
    assert sub.tier == "premium"
    assert (sub.expires_at - sub.started_at).days == 365


def test_subscribe_real_provider_501():
    user = _User(uuid4())
    db = _FakeSession(scalars_queue=[])  # short-circuits before any query
    with pytest.raises(HTTPException) as exc:
        _run(sub_api.subscribe(
            payload=SubscribeRequest(tier="standart", provider="click"),
            current_user=user, db=db,
        ))
    assert exc.value.status_code == 501


def test_subscribe_rejects_free_tier_at_schema():
    # 'free' is not a PaidTier literal → schema rejects before the endpoint.
    with pytest.raises(ValueError):
        SubscribeRequest(tier="free")


# ── Cancel ───────────────────────────────────────────────────────────────────

def test_cancel_reverts_to_free():
    user = _User(uuid4())
    from datetime import datetime
    existing = Subscription(
        user_id=user.id, tier="premium", status="active", provider="mock",
        started_at=datetime.now(UTC), expires_at=datetime.now(UTC),
    )
    db = _FakeSession(scalars_queue=[existing])
    sub = _run(sub_api.cancel(current_user=user, db=db))
    assert sub.tier == tiers.FREE
    assert sub.provider is None
    assert sub.expires_at is None
    assert db.flushed
