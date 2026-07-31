"""Report endpoint tests — ownership, cache hit/miss, refresh."""

import asyncio
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from fastapi import HTTPException

from duyo.api.v1 import report as rep
from duyo.models.report import Report


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


@dataclass
class _FakeSession:
    scalar_queue: list = field(default_factory=list)
    added: list = field(default_factory=list)
    flushed: bool = False

    async def scalar(self, *_a, **_kw):
        return self.scalar_queue.pop(0)

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
    c.age = 10  # endpoint passes child.age to build_report
    return c


_SECTIONS = {
    "activity": {"active_days": 3, "total_messages": 9, "conversations": 2, "window_days": 10},
    "mood": {"mood_trend": "barqaror", "mood_summary": "ok", "topics": [],
             "stress_signals": "", "highlight": ""},
    "safety": {"by_level": {"green": 9}, "concerning_count": 0, "had_red": False},
}


def _report(child_id, created_at):
    r = Report(
        child_id=child_id,
        period_start=created_at - timedelta(days=10),
        period_end=created_at,
        sections=_SECTIONS,
        llm_ok=True,
    )
    r.created_at = created_at
    return r


def test_report_unowned_404():
    user = _User(uuid4())
    db = _FakeSession(scalar_queue=[None])  # _owned_child → None
    with pytest.raises(HTTPException) as exc:
        _run(rep.get_report(child_id=uuid4(), refresh=False, current_user=user, db=db))
    assert exc.value.status_code == 404


def test_report_cache_hit_returns_cached():
    user = _User(uuid4())
    child = _child()
    fresh = _report(child.id, datetime.now(UTC) - timedelta(hours=2))  # < 1 day
    db = _FakeSession(scalar_queue=[child, fresh])  # owned, latest report
    result = _run(rep.get_report(child_id=child.id, refresh=False, current_user=user, db=db))
    assert result.cached is True
    assert db.added == []  # no new report generated


def _patch_build(monkeypatch, *, llm_ok=True):
    """Patch rep.build_report with a stub ReportData-like object."""
    @dataclass
    class _Data:
        now: datetime
        def __post_init__(self):
            self.period_start = self.now - timedelta(days=10)
            self.period_end = self.now
            self.sections = _SECTIONS
            self.llm_ok = llm_ok

    async def _fake_build(*_a, **kw):
        return _Data(kw["now"])
    monkeypatch.setattr(rep, "build_report", _fake_build)


def test_report_cache_miss_generates(monkeypatch):
    user = _User(uuid4())
    child = _child()
    stale = _report(child.id, datetime.now(UTC) - timedelta(days=3))  # > 1 day
    db = _FakeSession(scalar_queue=[child, stale])
    _patch_build(monkeypatch)

    result = _run(rep.get_report(child_id=child.id, refresh=False, current_user=user, db=db))
    assert result.cached is False
    assert db.added and isinstance(db.added[0], Report)
    assert db.flushed


def test_report_refresh_forces_regeneration(monkeypatch):
    user = _User(uuid4())
    child = _child()
    # refresh=True → no cache lookup; only _owned_child scalar consumed
    db = _FakeSession(scalar_queue=[child])
    _patch_build(monkeypatch, llm_ok=False)

    result = _run(rep.get_report(child_id=child.id, refresh=True, current_user=user, db=db))
    assert result.cached is False
    assert result.llm_ok is False
    assert db.added and isinstance(db.added[0], Report)


def test_report_no_prior_generates(monkeypatch):
    user = _User(uuid4())
    child = _child()
    db = _FakeSession(scalar_queue=[child, None])  # owned, no prior report
    _patch_build(monkeypatch)

    result = _run(rep.get_report(child_id=child.id, refresh=False, current_user=user, db=db))
    assert result.cached is False
    assert db.added


def test_report_exposes_cognitive_section(monkeypatch):
    """Regression: the response schema must not silently drop `cognitive`."""
    user = _User(uuid4())
    child = _child()
    db = _FakeSession(scalar_queue=[child])
    cognitive = {
        "vocabulary_level": "o'rta",
        "curiosity_signals": ["savol berish"],
        "note": "Rivojlanish kuzatuvi.",
    }

    @dataclass
    class _Data:
        now: datetime
        def __post_init__(self):
            self.period_start = self.now - timedelta(days=10)
            self.period_end = self.now
            self.sections = {**_SECTIONS, "cognitive": cognitive}
            self.llm_ok = True

    async def _fake_build(*_a, **kw):
        return _Data(kw["now"])
    monkeypatch.setattr(rep, "build_report", _fake_build)

    result = _run(rep.get_report(child_id=child.id, refresh=True, current_user=user, db=db))
    assert result.sections.cognitive is not None
    assert result.sections.cognitive.vocabulary_level == "o'rta"
    assert result.sections.cognitive.note == "Rivojlanish kuzatuvi."


# ── Trends (metrology — plottable series from cached reports) ────────────────

@dataclass
class _TrendsSession:
    """scalar() serves _owned_child; scalars() serves the report history."""

    scalar_queue: list = field(default_factory=list)
    reports: list = field(default_factory=list)

    async def scalar(self, *_a, **_kw):
        return self.scalar_queue.pop(0)

    async def scalars(self, *_a, **_kw):
        rows = self.reports
        return type("R", (), {"all": lambda _self: rows})()


def test_trends_unowned_404():
    user = _User(uuid4())
    db = _TrendsSession(scalar_queue=[None])
    with pytest.raises(HTTPException) as exc:
        _run(rep.get_trends(child_id=uuid4(), limit=12, current_user=user, db=db))
    assert exc.value.status_code == 404


def test_trends_returns_oldest_first_with_aggregates():
    user = _User(uuid4())
    child = _child()
    now = datetime.now(UTC)
    # Query returns newest-first; the endpoint must reverse for plotting.
    newer = _report(child.id, now)
    older = _report(child.id, now - timedelta(days=10))
    newer.sections = {**_SECTIONS, "cognitive": {"vocabulary_level": "yuqori",
                                                 "curiosity_signals": [], "note": ""}}
    db = _TrendsSession(scalar_queue=[child], reports=[newer, older])

    out = _run(rep.get_trends(child_id=child.id, limit=12, current_user=user, db=db))

    assert len(out.points) == 2
    assert out.points[0].period_end < out.points[1].period_end  # chronological
    assert out.points[1].vocabulary_level == "yuqori"
    assert out.points[0].active_days == 3
    assert out.points[0].mood_trend == "barqaror"


def test_trends_tolerates_reports_without_cognitive():
    """Older cached reports predate the cognitive pass — must not raise."""
    user = _User(uuid4())
    child = _child()
    legacy = _report(child.id, datetime.now(UTC))  # _SECTIONS has no "cognitive"
    db = _TrendsSession(scalar_queue=[child], reports=[legacy])

    out = _run(rep.get_trends(child_id=child.id, limit=12, current_user=user, db=db))
    assert out.points[0].vocabulary_level == ""


def test_trends_empty_history_returns_no_points():
    user = _User(uuid4())
    child = _child()
    db = _TrendsSession(scalar_queue=[child], reports=[])
    out = _run(rep.get_trends(child_id=child.id, limit=12, current_user=user, db=db))
    assert out.points == []
