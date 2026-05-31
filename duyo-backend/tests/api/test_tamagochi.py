"""Tamagochi endpoint tests — lazy decay, interact, ownership.

Fake-session style: endpoint functions called directly with a scripted
AsyncSession. The state object is a real TamagochiState so attribute
mutation by the endpoint is observable.
"""

import asyncio
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from fastapi import HTTPException

from duyo.api.v1 import tamagochi as tam
from duyo.models.tamagochi import TamagochiState
from duyo.schemas.tamagochi import TamagochiInteract


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


def _child():
    c = type("C", (), {})()
    c.id = uuid4()
    return c


def _state(child_id, last_decay_at, **metrics):
    base = dict(energy=100, joy=100, learning=100, health=100)
    base.update(metrics)
    s = TamagochiState(child_id=child_id, last_decay_at=last_decay_at, **base)
    return s


# ── Ownership ────────────────────────────────────────────────────────────────

def test_get_state_unowned_404():
    user = _User(uuid4())
    db = _FakeSession(scalars_queue=[None])
    with pytest.raises(HTTPException) as exc:
        _run(tam.get_state(child_id=uuid4(), current_user=user, db=db))
    assert exc.value.status_code == 404


# ── Lazy decay on read ───────────────────────────────────────────────────────

def test_get_state_applies_decay():
    user = _User(uuid4())
    child = _child()
    one_day_ago = datetime.now(UTC) - timedelta(days=1)
    state = _state(child.id, one_day_ago)
    db = _FakeSession(scalars_queue=[child, state])
    result = _run(tam.get_state(child_id=child.id, current_user=user, db=db))
    # ~1 day elapsed → energy ~90, health ~97 (small slack for sub-second drift)
    assert 89 <= result.energy <= 91
    assert 96 <= result.health <= 98
    assert db.flushed


def test_get_state_creates_default_when_missing():
    user = _User(uuid4())
    child = _child()
    db = _FakeSession(scalars_queue=[child, None])  # owned, no state yet
    result = _run(tam.get_state(child_id=child.id, current_user=user, db=db))
    assert result.energy == 100  # fresh, no elapsed time
    assert db.added and isinstance(db.added[0], TamagochiState)


# ── Interact restores ────────────────────────────────────────────────────────

def test_interact_lesson_restores_learning():
    user = _User(uuid4())
    child = _child()
    now = datetime.now(UTC)
    state = _state(child.id, now, learning=50)
    db = _FakeSession(scalars_queue=[child, state])
    result = _run(tam.interact(
        child_id=child.id, payload=TamagochiInteract(kind="lesson", amount=20),
        current_user=user, db=db,
    ))
    assert result.learning == 70
    assert result.energy == 100  # other metrics untouched (no elapsed decay)


def test_interact_check_in_restores_energy_clamped():
    user = _User(uuid4())
    child = _child()
    now = datetime.now(UTC)
    state = _state(child.id, now, energy=90)
    db = _FakeSession(scalars_queue=[child, state])
    result = _run(tam.interact(
        child_id=child.id, payload=TamagochiInteract(kind="check_in", amount=30),
        current_user=user, db=db,
    ))
    assert result.energy == 100  # 90 + 30 clamped to 100


def test_interact_settles_decay_before_boost():
    user = _User(uuid4())
    child = _child()
    one_day_ago = datetime.now(UTC) - timedelta(days=1)
    state = _state(child.id, one_day_ago, joy=100)
    db = _FakeSession(scalars_queue=[child, state])
    # joy decays 8/day → ~92, then play +10 → ~100 (clamped) or ~100
    result = _run(tam.interact(
        child_id=child.id, payload=TamagochiInteract(kind="play", amount=5),
        current_user=user, db=db,
    ))
    # 100 -> ~92 (decay) -> +5 = ~97
    assert 96 <= result.joy <= 98


def test_interact_unowned_404():
    user = _User(uuid4())
    db = _FakeSession(scalars_queue=[None])
    with pytest.raises(HTTPException) as exc:
        _run(tam.interact(
            child_id=uuid4(), payload=TamagochiInteract(kind="play"),
            current_user=user, db=db,
        ))
    assert exc.value.status_code == 404


def test_interact_rejects_bad_amount_at_schema():
    with pytest.raises(ValueError):
        TamagochiInteract(kind="play", amount=999)
    with pytest.raises(ValueError):
        TamagochiInteract(kind="play", amount=0)
