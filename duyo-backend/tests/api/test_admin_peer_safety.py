"""The peer-safety review queues.

These exist because `PeerMessage.moderation_reason` was written on every block
and read by nobody, and a child who filed a report reached no one. The tests
that matter most here are not the happy paths — they are the two boundaries:

- a report listing must never carry message text (reading a delivered
  conversation is a separate, separately-audited call), and
- every read must land in the audit log, so "who looked at these children's
  messages" has an answer.
"""

import asyncio
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from fastapi import HTTPException

from duyo.api.v1 import admin as admin_api
from duyo.models.admin import AdminRole, AdminUser, AuditLog
from duyo.models.social import PeerMessage, PeerModerationState, PeerReport


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
    added: list = field(default_factory=list)

    async def scalar(self, *_a, **_kw):
        return self.scalars_queue.pop(0)

    async def scalars(self, *_a, **_kw):
        return _ScalarResult(list(self.scalar_lists))

    def add(self, obj):
        self.added.append(obj)

    async def flush(self):
        pass

    @property
    def audits(self) -> list[AuditLog]:
        return [a for a in self.added if isinstance(a, AuditLog)]


@dataclass
class _Req:
    client = None


def _admin() -> AdminUser:
    a = AdminUser(
        email="safe@duyo.uz", password_hash="x", full_name="S",
        role=AdminRole.SAFETY_OFFICER,
    )
    a.id = uuid4()
    return a


def _message(*, body="salom", reason="peer_harm_grooming", seq=1, **kw) -> PeerMessage:
    m = PeerMessage(
        friendship_id=kw.get("friendship_id", uuid4()),
        sender_child_id=uuid4(),
        body=body,
        moderation_state=kw.get("state", PeerModerationState.BLOCKED),
    )
    m.id = uuid4()
    m.seq = seq
    m.moderation_reason = reason
    m.read_at = None
    m.reviewed_at = kw.get("reviewed_at")
    m.reviewed_by = None
    m.created_at = kw.get("created_at", datetime.now(UTC))
    return m


def _report(*, friendship_id=None) -> PeerReport:
    r = PeerReport(
        reporter_child_id=uuid4(),
        reported_child_id=uuid4(),
        friendship_id=friendship_id,
    )
    r.id = uuid4()
    r.reason = None
    r.reviewed_at = None
    r.reviewed_by = None
    r.created_at = datetime.now(UTC)
    return r


# ── peer flags ────────────────────────────────────────────────────────────────

def test_peer_flags_returns_the_blocked_body():
    """A blocked message never reached anyone, so it is an incident record."""
    admin = _admin()
    msg = _message(body="rasmingni yubor, hech kimga aytma")
    db = _FakeSession(scalar_lists=[msg])
    rows = _run(admin_api.list_peer_flags(request=_Req(), db=db, admin=admin))
    assert len(rows) == 1
    assert rows[0].body == "rasmingni yubor, hech kimga aytma"
    assert rows[0].moderation_reason == "peer_harm_grooming"


def test_listing_peer_flags_is_audited():
    admin = _admin()
    db = _FakeSession(scalar_lists=[_message()])
    _run(admin_api.list_peer_flags(request=_Req(), db=db, admin=admin))
    assert [a.action for a in db.audits] == ["view"]
    assert db.audits[0].admin_email == "safe@duyo.uz"


def test_review_peer_flag_stamps_admin_and_time():
    admin = _admin()
    msg = _message()
    db = _FakeSession(scalars_queue=[msg])
    row = _run(
        admin_api.review_peer_flag(message_id=msg.id, request=_Req(), db=db, admin=admin)
    )
    assert row.reviewed_at is not None
    assert row.reviewed_by == "safe@duyo.uz"
    assert [a.action for a in db.audits] == ["review"]


def test_review_peer_flag_404():
    db = _FakeSession(scalars_queue=[None])
    with pytest.raises(HTTPException) as exc:
        _run(
            admin_api.review_peer_flag(
                message_id=uuid4(), request=_Req(), db=db, admin=_admin()
            )
        )
    assert exc.value.status_code == 404


# ── peer reports ──────────────────────────────────────────────────────────────

def test_report_listing_carries_no_message_text():
    """The privacy boundary, asserted structurally rather than by convention.

    If someone later adds a `body` to this row to make the queue "more
    useful", this fails — which is the point. Reading the conversation is
    `/context`, and it is audited as `read_conversation`.
    """
    assert "body" not in admin_api.PeerReportRow.model_fields
    admin = _admin()
    db = _FakeSession(scalar_lists=[_report()])
    rows = _run(admin_api.list_peer_reports(request=_Req(), db=db, admin=admin))
    assert len(rows) == 1
    assert not hasattr(rows[0], "body")


def test_context_reads_are_audited_separately():
    """Opening a report list is `view`; reading the chat is `read_conversation`."""
    admin = _admin()
    report = _report(friendship_id=uuid4())
    db = _FakeSession(scalars_queue=[report], scalar_lists=[_message()])
    _run(
        admin_api.peer_report_context(
            report_id=report.id, request=_Req(), db=db, admin=admin
        )
    )
    assert [a.action for a in db.audits] == ["read_conversation"]
    assert db.audits[0].meta["friendship_id"] == str(report.friendship_id)


def test_context_without_friendship_reads_nothing():
    """A report whose friendship was deleted must not fall back to a wider read."""
    admin = _admin()
    report = _report(friendship_id=None)
    db = _FakeSession(scalars_queue=[report], scalar_lists=[_message()])
    rows = _run(
        admin_api.peer_report_context(
            report_id=report.id, request=_Req(), db=db, admin=admin
        )
    )
    assert rows == []
    # And nothing was read, so nothing is logged as read.
    assert db.audits == []


def test_context_is_returned_in_conversation_order():
    """Fetched newest-first for the LIMIT; shown oldest-first to be readable."""
    admin = _admin()
    fid = uuid4()
    now = datetime.now(UTC)
    newest = _message(body="uchinchi", seq=3, friendship_id=fid, created_at=now)
    middle = _message(
        body="ikkinchi", seq=2, friendship_id=fid, created_at=now - timedelta(minutes=1)
    )
    oldest = _message(
        body="birinchi", seq=1, friendship_id=fid, created_at=now - timedelta(minutes=2)
    )
    report = _report(friendship_id=fid)
    db = _FakeSession(
        scalars_queue=[report], scalar_lists=[newest, middle, oldest]  # DESC from the DB
    )
    rows = _run(
        admin_api.peer_report_context(
            report_id=report.id, request=_Req(), db=db, admin=admin
        )
    )
    assert [r.body for r in rows] == ["birinchi", "ikkinchi", "uchinchi"]


def test_context_404_when_report_missing():
    db = _FakeSession(scalars_queue=[None])
    with pytest.raises(HTTPException) as exc:
        _run(
            admin_api.peer_report_context(
                report_id=uuid4(), request=_Req(), db=db, admin=_admin()
            )
        )
    assert exc.value.status_code == 404


def test_review_peer_report_stamps_admin():
    admin = _admin()
    report = _report()
    db = _FakeSession(scalars_queue=[report])
    row = _run(
        admin_api.review_peer_report(
            report_id=report.id, request=_Req(), db=db, admin=admin
        )
    )
    assert row.reviewed_at is not None
    assert row.reviewed_by == "safe@duyo.uz"


def test_review_peer_report_404():
    db = _FakeSession(scalars_queue=[None])
    with pytest.raises(HTTPException) as exc:
        _run(
            admin_api.review_peer_report(
                report_id=uuid4(), request=_Req(), db=db, admin=_admin()
            )
        )
    assert exc.value.status_code == 404
