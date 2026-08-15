"""Notifications: campaigns filtered to a child's audience, per-child read state."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from uuid import uuid4

import pytest
from fastapi import HTTPException

from duyo.api.v1 import notifications as mod
from duyo.models.child import AgeSegment, ChildProfile, Language
from duyo.models.notification import Campaign, CampaignChannel, CampaignStatus


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


@dataclass
class _ScalarsResult:
    rows: list

    def all(self):
        return list(self.rows)


@dataclass
class _ExecResult:
    rows: list

    def scalars(self):
        return _ScalarsResult(self.rows)


@dataclass
class _FakeSession:
    scalar_queue: list = field(default_factory=list)
    execute_queue: list = field(default_factory=list)
    scalars_queue: list = field(default_factory=list)
    executed: list = field(default_factory=list)
    flushed: bool = False

    async def scalar(self, *_a, **_kw):
        return self.scalar_queue.pop(0)

    async def scalars(self, *_a, **_kw):
        return _ScalarsResult(self.scalars_queue.pop(0))

    async def execute(self, stmt, *_a, **_kw):
        self.executed.append(stmt)
        return self.execute_queue.pop(0) if self.execute_queue else _ExecResult([])

    async def flush(self):
        self.flushed = True


@dataclass
class _User:
    id: object


def _child(parent_id, age_segment=AgeSegment.EXPLORER):
    return ChildProfile(
        id=uuid4(), parent_id=parent_id, name="Aziza", age=12,
        age_segment=age_segment, language=Language.UZ,
    )


def _campaign(audience="all", channel=CampaignChannel.IN_APP, status=CampaignStatus.SENT):
    return Campaign(
        id=uuid4(), channel=channel, title="Yangilik", body="Salom!",
        audience=audience, status=status,
    )


# ── list ─────────────────────────────────────────────────────────────────────

def test_list_marks_unread_by_default():
    user = _User(uuid4())
    child = _child(user.id)
    campaign = _campaign()
    db = _FakeSession(
        scalar_queue=[child],
        execute_queue=[_ExecResult([campaign])],
        scalars_queue=[[]],  # no NotificationRead rows for this child
    )

    out = _run(mod.list_notifications(child_id=child.id, current_user=user, db=db))

    assert len(out) == 1
    assert out[0].id == campaign.id
    assert out[0].read is False


def test_list_reflects_read_state():
    user = _User(uuid4())
    child = _child(user.id)
    campaign = _campaign()
    db = _FakeSession(
        scalar_queue=[child],
        execute_queue=[_ExecResult([campaign])],
        scalars_queue=[[campaign.id]],  # this campaign has a NotificationRead row
    )

    out = _run(mod.list_notifications(child_id=child.id, current_user=user, db=db))

    assert out[0].read is True


def test_list_skips_read_lookup_when_no_campaigns():
    user = _User(uuid4())
    child = _child(user.id)
    db = _FakeSession(scalar_queue=[child], execute_queue=[_ExecResult([])])

    out = _run(mod.list_notifications(child_id=child.id, current_user=user, db=db))

    assert out == []
    assert db.scalars_queue == []  # never consumed — no early scalars() call


def test_list_rejects_another_familys_child():
    user = _User(uuid4())
    db = _FakeSession(scalar_queue=[None])
    with pytest.raises(HTTPException) as exc:
        _run(mod.list_notifications(child_id=uuid4(), current_user=user, db=db))
    assert exc.value.status_code == 404


# ── mark_read ────────────────────────────────────────────────────────────────

def test_mark_read_returns_the_notification_as_read():
    user = _User(uuid4())
    child = _child(user.id)
    campaign = _campaign()
    db = _FakeSession(scalar_queue=[child, campaign])

    out = _run(mod.mark_read(
        campaign_id=campaign.id, child_id=child.id, current_user=user, db=db,
    ))

    assert out.read is True
    assert out.id == campaign.id
    assert db.flushed is True
    assert len(db.executed) == 1  # the upsert


def test_mark_read_404_for_unmatched_campaign():
    """Wrong audience, wrong channel, or not sent — the query just finds nothing."""
    user = _User(uuid4())
    child = _child(user.id)
    db = _FakeSession(scalar_queue=[child, None])
    with pytest.raises(HTTPException) as exc:
        _run(mod.mark_read(
            campaign_id=uuid4(), child_id=child.id, current_user=user, db=db,
        ))
    assert exc.value.status_code == 404


# ── unread_count ─────────────────────────────────────────────────────────────

def test_unread_count_subtracts_read_from_total():
    user = _User(uuid4())
    child = _child(user.id)
    db = _FakeSession(scalar_queue=[child, 5, 2])

    out = _run(mod.unread_count(child_id=child.id, current_user=user, db=db))

    assert out.count == 3


def test_unread_count_never_goes_negative():
    """Read count can't exceed total in practice, but the clamp guards it anyway."""
    user = _User(uuid4())
    child = _child(user.id)
    db = _FakeSession(scalar_queue=[child, 0, 0])

    out = _run(mod.unread_count(child_id=child.id, current_user=user, db=db))

    assert out.count == 0
