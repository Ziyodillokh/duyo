"""Tests for message feedback — the human-gated learning dataset.

Endpoint functions are called directly with a fake AsyncSession (no real DB),
matching the repo's API-test style. The key guarantees pinned here: ownership
(another family's message is invisible), re-rating overwrites instead of
stacking, and a changed vote re-opens the item for admin triage.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from datetime import UTC, datetime
from uuid import uuid4

import pytest
from fastapi import HTTPException

from duyo.api.v1 import chat as chat_module
from duyo.models.child import AgeSegment, ChildProfile, Language
from duyo.models.feedback import FeedbackRating, MessageFeedback
from duyo.schemas.chat import FeedbackRequest


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


@dataclass
class _FakeResult:
    rows: list

    def scalar_one_or_none(self):
        return self.rows[0] if self.rows else None


@dataclass
class _FakeSession:
    """execute() serves _get_owned_child; scalar() serves message + feedback lookups."""

    child_result: _FakeResult
    scalar_queue: list = field(default_factory=list)
    added: list = field(default_factory=list)
    flushed: bool = False

    async def execute(self, *_a, **_kw):
        return self.child_result

    async def scalar(self, *_a, **_kw):
        return self.scalar_queue.pop(0)

    def add(self, obj):
        self.added.append(obj)

    async def flush(self):
        self.flushed = True


@dataclass
class _FakeUser:
    id: object


def _child(parent_id):
    return ChildProfile(
        id=uuid4(), parent_id=parent_id, name="Aziza", age=11,
        age_segment=AgeSegment.EXPLORER, language=Language.UZ,
    )


def _payload(child_id, rating="up", reason=None):
    return FeedbackRequest(child_id=child_id, rating=rating, reason=reason)


def test_first_rating_creates_a_row():
    user = _FakeUser(id=uuid4())
    child = _child(user.id)
    message_id = uuid4()
    db = _FakeSession(
        child_result=_FakeResult([child]),
        scalar_queue=[object(), None],  # message found, no existing feedback
    )

    resp = _run(chat_module.rate_message(message_id, _payload(child.id), user, db))

    assert resp.rating == "up"
    assert resp.message_id == message_id
    assert len(db.added) == 1
    row = db.added[0]
    assert isinstance(row, MessageFeedback)
    assert row.rating is FeedbackRating.UP
    assert row.child_id == child.id
    assert db.flushed is True


def test_rerating_updates_and_reopens_for_triage():
    user = _FakeUser(id=uuid4())
    child = _child(user.id)
    existing = MessageFeedback(
        message_id=uuid4(), child_id=child.id, rating=FeedbackRating.UP,
        reviewed_at=datetime.now(UTC), reviewed_by="admin@duyo.uz",
    )
    db = _FakeSession(
        child_result=_FakeResult([child]),
        scalar_queue=[object(), existing],  # message found, feedback exists
    )

    resp = _run(chat_module.rate_message(
        existing.message_id, _payload(child.id, rating="down", reason="noto'g'ri"), user, db,
    ))

    assert resp.rating == "down"
    assert db.added == []                       # updated, not stacked
    assert existing.rating is FeedbackRating.DOWN
    assert existing.reason == "noto'g'ri"
    assert existing.reviewed_at is None         # re-opened
    assert existing.reviewed_by is None


def test_message_from_another_family_is_404():
    user = _FakeUser(id=uuid4())
    child = _child(user.id)
    db = _FakeSession(
        child_result=_FakeResult([child]),
        scalar_queue=[None],  # ownership-scoped message lookup finds nothing
    )

    with pytest.raises(HTTPException) as exc:
        _run(chat_module.rate_message(uuid4(), _payload(child.id), user, db))
    assert exc.value.status_code == 404


def test_unknown_child_is_404_before_any_message_lookup():
    user = _FakeUser(id=uuid4())
    db = _FakeSession(child_result=_FakeResult([]), scalar_queue=[])

    with pytest.raises(HTTPException) as exc:
        _run(chat_module.rate_message(uuid4(), _payload(uuid4()), user, db))
    assert exc.value.status_code == 404
