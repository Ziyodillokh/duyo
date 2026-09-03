"""Tests for reporting one of DUYO's own replies.

Sits alongside tests/api/test_feedback.py and tests/api/test_group_safety.py:
the same route-called-directly style, and the same properties a safety queue
lives or dies on. What is pinned here:

* the report is a DIFFERENT record from a 👎 — the ratings table is untouched;
* DUYO's words are copied into the row, so the child deleting the conversation
  afterwards cannot erase what a reviewer needs to read;
* another family's message is invisible, exactly as it is to the rating route;
* re-reporting replaces the reason and re-opens triage instead of filing a
  second row;
* an unknown reason never reaches the database at all.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from datetime import UTC, datetime
from uuid import uuid4

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from duyo.api.v1 import chat as chat_module
from duyo.models.ai_report import AiMessageReport, AiReportReason
from duyo.models.child import AgeSegment, ChildProfile, Language
from duyo.models.feedback import MessageFeedback


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


@dataclass
class _FakeResult:
    rows: list

    def scalar_one_or_none(self):
        return self.rows[0] if self.rows else None


@dataclass
class _FakeSession:
    """execute() serves _get_owned_child; scalar() serves message + report lookups."""

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


@dataclass
class _FakeMessage:
    """Only the two fields the route copies out of a stored reply."""

    content: str
    model: str | None = "gemini-2.5-flash"


def _child(parent_id):
    return ChildProfile(
        id=uuid4(), parent_id=parent_id, name="Aziza", age=13,
        age_segment=AgeSegment.EXPLORER, language=Language.UZ,
    )


def _payload(child_id, reason="harmful"):
    return chat_module.AiReportRequest(child_id=child_id, reason=reason)


def test_report_stores_the_reply_text_and_the_reason():
    user = _FakeUser(id=uuid4())
    child = _child(user.id)
    message_id = uuid4()
    reply = _FakeMessage(content="Bu juda qo'rqinchli gap edi.")
    db = _FakeSession(
        child_result=_FakeResult([child]),
        scalar_queue=[reply, None],  # message found, not reported before
    )

    resp = _run(
        chat_module.report_message(message_id, _payload(child.id, "scary"), user, db)
    )

    assert resp == {"status": "received"}
    assert len(db.added) == 1
    row = db.added[0]
    assert isinstance(row, AiMessageReport)
    # Not a rating: a 👎 on the same reply would have produced this instead.
    assert not any(isinstance(o, MessageFeedback) for o in db.added)
    assert row.message_id == message_id
    assert row.child_id == child.id
    assert row.reason == AiReportReason.SCARY.value
    assert row.model_output == reply.content
    assert row.model_name == "gemini-2.5-flash"
    assert row.reviewed_at is None
    assert db.flushed is True


def test_reporting_twice_replaces_the_reason_and_reopens_triage():
    user = _FakeUser(id=uuid4())
    child = _child(user.id)
    message_id = uuid4()
    existing = AiMessageReport(
        message_id=message_id, child_id=child.id,
        reason=AiReportReason.OTHER.value, model_output="eski matn",
        reviewed_at=datetime.now(UTC), reviewed_by="admin@duyo.uz",
    )
    db = _FakeSession(
        child_result=_FakeResult([child]),
        scalar_queue=[_FakeMessage(content="eski matn"), existing],
    )

    resp = _run(
        chat_module.report_message(message_id, _payload(child.id, "hateful"), user, db)
    )

    assert resp == {"status": "received"}
    assert db.added == []                            # updated, not stacked
    assert existing.reason == AiReportReason.HATEFUL.value
    assert existing.reviewed_at is None
    assert existing.reviewed_by is None


def test_message_from_another_family_is_404():
    user = _FakeUser(id=uuid4())
    child = _child(user.id)
    db = _FakeSession(
        child_result=_FakeResult([child]),
        scalar_queue=[None],  # ownership-scoped lookup finds nothing
    )

    with pytest.raises(HTTPException) as exc:
        _run(chat_module.report_message(uuid4(), _payload(child.id), user, db))
    assert exc.value.status_code == 404
    assert db.added == []


def test_unknown_child_is_404_before_any_message_lookup():
    user = _FakeUser(id=uuid4())
    db = _FakeSession(child_result=_FakeResult([]), scalar_queue=[])

    with pytest.raises(HTTPException) as exc:
        _run(chat_module.report_message(uuid4(), _payload(uuid4()), user, db))
    assert exc.value.status_code == 404


def test_an_invented_reason_is_rejected_at_the_boundary():
    # The column is a plain string, so this is the only thing standing between
    # the queue and arbitrary text pasted in from a modified client.
    with pytest.raises(ValidationError):
        chat_module.AiReportRequest(child_id=uuid4(), reason="because")


def test_every_offered_reason_is_accepted():
    # The five the sheet shows and the five the API takes must not drift apart.
    for reason in AiReportReason:
        assert chat_module.AiReportRequest(
            child_id=uuid4(), reason=reason.value
        ).reason is reason
