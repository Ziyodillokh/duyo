"""Gamification endpoint tests — balls, spend, purchase, streak, ownership.

Fake-session style matching the repo: endpoint functions are called directly
with a scripted AsyncSession. `scalar()` returns queued values in call order;
`execute()` returns queued result objects.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from uuid import uuid4

import pytest
from fastapi import HTTPException

from duyo.api.v1 import gamification as gam
from duyo.models.gamification import Avatar, BallsTransaction, InventoryItem, Streak
from duyo.schemas.gamification import (
    AvatarUpdate,
    BallsAward,
    BallsSpend,
    InventoryPurchase,
)


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


@dataclass
class _FakeResult:
    rows: list

    def scalars(self):
        return self

    def all(self):
        return list(self.rows)


@dataclass
class _FakeSession:
    scalars_queue: list = field(default_factory=list)
    execute_queue: list = field(default_factory=list)
    added: list = field(default_factory=list)
    flushed: bool = False

    async def scalar(self, *_a, **_kw):
        return self.scalars_queue.pop(0)

    async def execute(self, *_a, **_kw):
        return self.execute_queue.pop(0)

    def add(self, obj):
        self.added.append(obj)

    async def flush(self):
        self.flushed = True


@dataclass
class _User:
    id: object


def _child():
    c = type("C", (), {})()
    c.id = uuid4()
    return c


# ── Ownership ────────────────────────────────────────────────────────────────

def test_get_balls_unowned_child_404():
    user = _User(uuid4())
    db = _FakeSession(scalars_queue=[None])  # _owned_child → None
    with pytest.raises(HTTPException) as exc:
        _run(gam.get_balls(child_id=uuid4(), current_user=user, db=db))
    assert exc.value.status_code == 404


def test_update_avatar_unowned_404():
    user = _User(uuid4())
    db = _FakeSession(scalars_queue=[None])
    with pytest.raises(HTTPException) as exc:
        _run(gam.update_avatar(
            child_id=uuid4(), payload=AvatarUpdate(primary_color="purple"),
            current_user=user, db=db,
        ))
    assert exc.value.status_code == 404


def test_update_avatar_applies_accessory_accent():
    user = _User(uuid4())
    child = _child()
    avatar = Avatar(child_id=child.id)
    db = _FakeSession(scalars_queue=[child, avatar])  # owned_child, existing avatar
    result = _run(gam.update_avatar(
        child_id=child.id,
        payload=AvatarUpdate(accent="cap", body_shape="cube"),
        current_user=user, db=db,
    ))
    assert result.accent == "cap"
    assert result.body_shape == "cube"
    assert db.flushed


def test_avatar_update_rejects_unknown_accent():
    with pytest.raises(ValueError):
        AvatarUpdate(accent="hat")  # not in none/star/cap/glasses


# ── Balls ────────────────────────────────────────────────────────────────────

def test_get_balls_returns_level():
    user = _User(uuid4())
    child = _child()
    db = _FakeSession(scalars_queue=[child, 250])  # owned_child, balance
    result = _run(gam.get_balls(child_id=child.id, current_user=user, db=db))
    assert result.balance == 250
    assert result.level == 2
    assert result.level_name == "Do'st"
    assert result.balls_to_next == 250


def test_award_balls_adds_transaction():
    user = _User(uuid4())
    child = _child()
    db = _FakeSession(scalars_queue=[child, 100])  # owned_child, current balance
    result = _run(gam.award_balls(
        child_id=child.id, payload=BallsAward(amount=50, reason="lesson"),
        current_user=user, db=db,
    ))
    assert result.balance == 150
    tx = db.added[0]
    assert isinstance(tx, BallsTransaction)
    assert tx.amount == 50 and tx.balance_after == 150
    assert db.flushed


def test_spend_balls_insufficient_400():
    user = _User(uuid4())
    child = _child()
    db = _FakeSession(scalars_queue=[child, 10])  # balance 10
    with pytest.raises(HTTPException) as exc:
        _run(gam.spend_balls(
            child_id=child.id, payload=BallsSpend(amount=50, reason="hat"),
            current_user=user, db=db,
        ))
    assert exc.value.status_code == 400
    assert db.added == []  # nothing deducted


def test_spend_balls_ok_records_negative():
    user = _User(uuid4())
    child = _child()
    db = _FakeSession(scalars_queue=[child, 100])
    result = _run(gam.spend_balls(
        child_id=child.id, payload=BallsSpend(amount=30, reason="hat"),
        current_user=user, db=db,
    ))
    assert result.balance == 70
    assert db.added[0].amount == -30
    assert db.added[0].balance_after == 70


# ── Inventory purchase ───────────────────────────────────────────────────────

def test_purchase_already_owned_409():
    user = _User(uuid4())
    child = _child()
    owned = InventoryItem(child_id=child.id, item_key="hat_red", category="hat")
    db = _FakeSession(scalars_queue=[child, owned])  # owned_child, existing item
    with pytest.raises(HTTPException) as exc:
        _run(gam.purchase_item(
            child_id=child.id,
            payload=InventoryPurchase(item_key="hat_red", category="hat", cost=50),
            current_user=user, db=db,
        ))
    assert exc.value.status_code == 409


def test_purchase_insufficient_400():
    user = _User(uuid4())
    child = _child()
    db = _FakeSession(scalars_queue=[child, None, 10])  # child, no existing, balance 10
    with pytest.raises(HTTPException) as exc:
        _run(gam.purchase_item(
            child_id=child.id,
            payload=InventoryPurchase(item_key="hat_red", category="hat", cost=100),
            current_user=user, db=db,
        ))
    assert exc.value.status_code == 400
    assert db.added == []


def test_purchase_ok_deducts_and_adds_item():
    user = _User(uuid4())
    child = _child()
    db = _FakeSession(scalars_queue=[child, None, 500])  # child, no existing, balance 500
    item = _run(gam.purchase_item(
        child_id=child.id,
        payload=InventoryPurchase(item_key="hat_red", category="hat", cost=100),
        current_user=user, db=db,
    ))
    assert item.item_key == "hat_red"
    # one ball-deduction transaction + one inventory item
    kinds = {type(o).__name__ for o in db.added}
    assert kinds == {"BallsTransaction", "InventoryItem"}
    tx = next(o for o in db.added if isinstance(o, BallsTransaction))
    assert tx.amount == -100 and tx.balance_after == 400


def test_purchase_free_item_no_transaction():
    user = _User(uuid4())
    child = _child()
    db = _FakeSession(scalars_queue=[child, None, 0])  # balance 0, cost 0
    item = _run(gam.purchase_item(
        child_id=child.id,
        payload=InventoryPurchase(item_key="starter", category="hat", cost=0),
        current_user=user, db=db,
    ))
    assert item.item_key == "starter"
    assert all(not isinstance(o, BallsTransaction) for o in db.added)


# ── Avatar get-or-create ─────────────────────────────────────────────────────

def test_get_avatar_creates_default_when_missing():
    user = _User(uuid4())
    child = _child()
    db = _FakeSession(scalars_queue=[child, None])  # owned_child, no avatar yet
    avatar = _run(gam.get_avatar(child_id=child.id, current_user=user, db=db))
    assert isinstance(avatar, Avatar)
    assert db.added and isinstance(db.added[0], Avatar)


# ── Streak ───────────────────────────────────────────────────────────────────

def test_streak_checkin_first_time():
    user = _User(uuid4())
    child = _child()
    streak = Streak(child_id=child.id, current_streak=0, longest_streak=0,
                    last_active_date=None)
    db = _FakeSession(scalars_queue=[child, streak])  # owned_child, streak
    result = _run(gam.streak_checkin(child_id=child.id, current_user=user, db=db))
    assert result.current_streak == 1
    assert result.longest_streak == 1
    assert db.flushed


def test_streak_checkin_same_day_noop():
    from datetime import date
    user = _User(uuid4())
    child = _child()
    streak = Streak(child_id=child.id, current_streak=3, longest_streak=5,
                    last_active_date=date.today())
    db = _FakeSession(scalars_queue=[child, streak])
    result = _run(gam.streak_checkin(child_id=child.id, current_user=user, db=db))
    assert result.current_streak == 3  # unchanged
    assert db.flushed is False
