"""The AI-reply review queue.

The mobile side of this already works: a child can report one of DUYO's own
replies, and tests/api/test_ai_report.py pins that the row is written. These
pin the other half — that a person can actually read it. Play asks for the
mechanism AND for the developer to act on what it collects, and a queue nobody
opens is the same as no queue at all.

What matters here is the inverse of the peer-report boundary: that queue must
never carry message text, this one must ALWAYS carry it. The words are DUYO's
own output, and a reviewer who cannot read them cannot judge them.
"""

import asyncio
from dataclasses import dataclass, field
from datetime import UTC, datetime
from uuid import uuid4

import pytest
from fastapi import HTTPException

from duyo.api.v1 import admin as admin_api
from duyo.models.admin import AdminRole, AdminUser, AuditLog
from duyo.models.ai_report import AiMessageReport, AiReportReason
from duyo.models.crisis_event import CrisisLevel


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
    execute_rows: list = field(default_factory=list)
    added: list = field(default_factory=list)

    async def scalar(self, *_a, **_kw):
        return self.scalars_queue.pop(0)

    async def scalars(self, *_a, **_kw):
        return _ScalarResult(list(self.scalar_lists))

    async def execute(self, *_a, **_kw):
        return _ScalarResult(list(self.execute_rows))

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


def _report(
    *,
    reason=AiReportReason.HARMFUL,
    model_output="Bu javob noto'g'ri edi.",
    message_id=None,
) -> AiMessageReport:
    r = AiMessageReport(
        message_id=message_id if message_id is not None else uuid4(),
        child_id=uuid4(),
        reason=reason.value,
        model_output=model_output,
        model_name="gemini-2.5-flash",
    )
    r.id = uuid4()
    r.reviewed_at = None
    r.reviewed_by = None
    r.created_at = datetime.now(UTC)
    return r


def test_queue_carries_the_reported_reply_in_full():
    """The opposite boundary from PeerReportRow, and asserted the same way.

    If someone later truncates this to a preview to tidy the table, the
    moderator is judging an AI answer they have not read.
    """
    assert "model_output" in admin_api.AiReportRow.model_fields
    long_reply = "Bir " * 400
    admin = _admin()
    db = _FakeSession(scalar_lists=[_report(model_output=long_reply)])
    rows = _run(admin_api.list_ai_reports(request=_Req(), db=db, admin=admin))
    assert len(rows) == 1
    assert rows[0].model_output == long_reply


def test_queue_row_carries_the_reason_the_child_picked():
    admin = _admin()
    db = _FakeSession(scalar_lists=[_report(reason=AiReportReason.SCARY)])
    rows = _run(admin_api.list_ai_reports(request=_Req(), db=db, admin=admin))
    assert rows[0].reason == "scary"
    assert rows[0].child_id is not None
    assert rows[0].created_at is not None


def test_a_report_survives_its_message_being_deleted():
    """`message_id` is SET NULL on delete; the snapshot is what gets read."""
    admin = _admin()
    orphan = _report(model_output="o'chirilgan suhbatdagi javob")
    orphan.message_id = None
    db = _FakeSession(scalar_lists=[orphan])
    rows = _run(admin_api.list_ai_reports(request=_Req(), db=db, admin=admin))
    assert rows[0].message_id is None
    assert rows[0].model_output == "o'chirilgan suhbatdagi javob"


def test_listing_ai_reports_is_audited():
    admin = _admin()
    db = _FakeSession(scalar_lists=[_report()])
    _run(admin_api.list_ai_reports(request=_Req(), db=db, admin=admin))
    assert [a.action for a in db.audits] == ["view"]
    assert db.audits[0].admin_email == "safe@duyo.uz"
    assert db.audits[0].module == "safety"


def test_review_stamps_admin_and_time():
    admin = _admin()
    report = _report()
    db = _FakeSession(scalars_queue=[report])
    row = _run(
        admin_api.review_ai_report(
            report_id=report.id, request=_Req(), db=db, admin=admin
        )
    )
    assert row.reviewed_at is not None
    assert row.reviewed_by == "safe@duyo.uz"
    assert [a.action for a in db.audits] == ["review"]


def test_review_404_when_report_missing():
    db = _FakeSession(scalars_queue=[None])
    with pytest.raises(HTTPException) as exc:
        _run(
            admin_api.review_ai_report(
                report_id=uuid4(), request=_Req(), db=db, admin=_admin()
            )
        )
    assert exc.value.status_code == 404


def test_the_queue_is_behind_the_same_role_as_the_peer_queue():
    """A moderation queue is the last place to grow a second auth pattern."""
    routes = {
        r.name: r
        for r in admin_api.router.routes
        if getattr(r, "name", None)
        in {"list_ai_reports", "review_ai_report", "list_peer_reports"}
    }
    assert set(routes) == {"list_ai_reports", "review_ai_report", "list_peer_reports"}

    def _deps(route) -> set:
        return {d.call for d in route.dependant.dependencies}

    peer = _deps(routes["list_peer_reports"])
    assert _deps(routes["list_ai_reports"]) == peer
    assert _deps(routes["review_ai_report"]) == peer


def test_summary_counts_open_ai_reports_beside_the_peer_ones():
    # scalar() is called for peer flags, peer reports, then AI reports.
    db = _FakeSession(execute_rows=[(CrisisLevel.RED, 2)], scalars_queue=[1, 3, 7])
    counts = _run(admin_api.safety_summary(db=db, _=_admin()))
    assert counts["ai_reports_unreviewed"] == 7
    assert counts["peer_reports_unreviewed"] == 3
    assert counts["RED"] == 2
