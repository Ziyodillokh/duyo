"""Admin safety write-actions (notify-parent, review) + payments listing."""

import asyncio
from dataclasses import dataclass, field
from datetime import UTC, datetime
from uuid import uuid4

import pytest
from fastapi import HTTPException

from duyo.api.v1 import admin as admin_api
from duyo.api.v1 import admin_modules as mod_api
from duyo.models.admin import AdminRole, AdminUser
from duyo.models.crisis_event import CrisisEvent, CrisisLevel
from duyo.models.payment import Payment, PaymentProvider, PaymentState


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


@dataclass
class _ScalarResult:
    rows: list

    def all(self):
        return self.rows


@dataclass
class _FakeSession:
    scalars_queue: list = field(default_factory=list)
    scalar_lists: list = field(default_factory=list)
    flushed: bool = False

    async def scalar(self, *_a, **_kw):
        return self.scalars_queue.pop(0)

    async def scalars(self, *_a, **_kw):
        return _ScalarResult(list(self.scalar_lists))

    def add(self, _obj):
        pass

    async def flush(self):
        self.flushed = True


@dataclass
class _Req:
    client = None


def _admin():
    a = AdminUser(email="safe@duyo.uz", password_hash="x", full_name="S", role=AdminRole.SAFETY_OFFICER)
    a.id = uuid4()
    return a


def _crisis(**kw) -> CrisisEvent:
    e = CrisisEvent(child_id=uuid4(), level=CrisisLevel.YELLOW, layer=1)
    e.id = kw.get("id", uuid4())
    e.matches = None
    e.parent_notified = kw.get("parent_notified", False)
    e.parent_notified_at = None
    e.reviewed_at = None
    e.reviewed_by = None
    e.created_at = datetime.now(UTC)
    return e


# ── notify-parent ─────────────────────────────────────────────────────────────

def test_notify_parent_sets_flag():
    admin = _admin()
    event = _crisis()
    db = _FakeSession(scalars_queue=[event])
    row = _run(admin_api.notify_parent(event_id=event.id, request=_Req(), db=db, admin=admin))
    assert row.parent_notified is True
    assert event.parent_notified_at is not None


def test_notify_parent_idempotent():
    admin = _admin()
    event = _crisis(parent_notified=True)
    event.parent_notified_at = datetime.now(UTC)
    db = _FakeSession(scalars_queue=[event])
    row = _run(admin_api.notify_parent(event_id=event.id, request=_Req(), db=db, admin=admin))
    assert row.parent_notified is True


def test_notify_parent_404():
    admin = _admin()
    db = _FakeSession(scalars_queue=[None])
    with pytest.raises(HTTPException) as exc:
        _run(admin_api.notify_parent(event_id=uuid4(), request=_Req(), db=db, admin=admin))
    assert exc.value.status_code == 404


# ── review ────────────────────────────────────────────────────────────────────

def test_review_records_admin_and_time():
    admin = _admin()
    event = _crisis()
    db = _FakeSession(scalars_queue=[event])
    row = _run(admin_api.review_crisis(event_id=event.id, request=_Req(), db=db, admin=admin))
    assert row.reviewed_at is not None
    assert row.reviewed_by == "safe@duyo.uz"


def test_review_404():
    admin = _admin()
    db = _FakeSession(scalars_queue=[None])
    with pytest.raises(HTTPException) as exc:
        _run(admin_api.review_crisis(event_id=uuid4(), request=_Req(), db=db, admin=admin))
    assert exc.value.status_code == 404


# ── payments listing ───────────────────────────────────────────────────────────

def _payment(state=PaymentState.PAID) -> Payment:
    p = Payment(
        user_id=uuid4(), provider=PaymentProvider.CLICK,
        tier="standart", period="monthly", amount=29_000, state=state,
    )
    p.id = uuid4()
    p.provider_trans_id = "T1"
    p.created_at = datetime.now(UTC)
    return p


def test_payments_list_maps_enum_values():
    db = _FakeSession(scalar_lists=[_payment()])
    rows = _run(mod_api.payments_list(limit=10, db=db, _=None))
    assert len(rows) == 1
    assert rows[0].provider == "click"
    assert rows[0].state == "paid"
    assert rows[0].amount == 29_000
