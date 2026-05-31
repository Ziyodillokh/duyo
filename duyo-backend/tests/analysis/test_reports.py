"""Parent report generation tests (Concept §11).

The metric aggregates hit the DB via scripted fake results; the LLM mood pass
is monkeypatched so no network call happens. Privacy §11.3 is asserted: no
message text leaks into the report sections.
"""

import asyncio
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from duyo.analysis import reports as rpt
from duyo.models.crisis_event import CrisisLevel


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


@dataclass
class _Result:
    rows: list

    def one(self):
        return self.rows[0]

    def all(self):
        return list(self.rows)


@dataclass
class _FakeSession:
    """execute() returns queued _Result; scalar() returns queued scalars."""
    execute_queue: list = field(default_factory=list)
    scalar_queue: list = field(default_factory=list)

    async def execute(self, *_a, **_kw):
        return self.execute_queue.pop(0)

    async def scalar(self, *_a, **_kw):
        return self.scalar_queue.pop(0)


# ── LLM mood pass (pure-ish, monkeypatched network) ──────────────────────────

def test_mood_section_too_few_messages_is_metrics_only():
    section, ok = _run(rpt._mood_section(["salom"]))
    assert ok is False
    assert section["mood_trend"] == "ma'lumot yetarli emas"


def test_mood_section_llm_failure_falls_back(monkeypatch):
    def _boom():
        raise RuntimeError("api down")
    monkeypatch.setattr(rpt, "get_client", _boom)
    section, ok = _run(rpt._mood_section(["a", "b", "c", "d"]))
    assert ok is False
    assert section == rpt._EMPTY_MOOD


def test_mood_section_parses_llm_json(monkeypatch):
    class _Resp:
        text = (
            '{"mood_trend":"ijobiy","mood_summary":"Yaxshi kayfiyat",'
            '"topics":["maktab","do\'stlar"],"stress_signals":"",'
            '"highlight":"matematikaga qiziqdi"}'
        )

    class _Models:
        async def generate_content(self, **_kw):
            return _Resp()

    class _Aio:
        models = _Models()

    class _Client:
        aio = _Aio()

    monkeypatch.setattr(rpt, "get_client", lambda: _Client())
    section, ok = _run(rpt._mood_section(["a", "b", "c", "d", "e"]))
    assert ok is True
    assert section["mood_trend"] == "ijobiy"
    assert "maktab" in section["topics"]
    assert section["highlight"] == "matematikaga qiziqdi"


def test_mood_section_truncates_overlong_fields(monkeypatch):
    long = "x" * 999
    class _Resp:
        text = f'{{"mood_summary":"{long}","topics":[],"stress_signals":"","highlight":""}}'
    class _Models:
        async def generate_content(self, **_kw):
            return _Resp()
    class _Client:
        aio = type("A", (), {"models": _Models()})()
    monkeypatch.setattr(rpt, "get_client", lambda: _Client())
    section, ok = _run(rpt._mood_section(["a", "b", "c"]))
    assert ok is True
    assert len(section["mood_summary"]) <= 400


# ── build_report wiring (metrics + mood) ─────────────────────────────────────

def test_build_report_assembles_sections(monkeypatch):
    child_id = uuid4()
    now = datetime(2026, 6, 1, tzinfo=UTC)

    # _activity_section: 1 execute (count,distinct) + 1 scalar (conv count)
    # _safety_section: 1 execute (group by level)
    # _fetch_child_messages: 1 execute (contents)
    db = _FakeSession(
        execute_queue=[
            _Result([(12, 4)]),                       # total_messages=12, active_days=4
            _Result([(CrisisLevel.GREEN, 10), (CrisisLevel.YELLOW, 2)]),  # crisis levels
            _Result([("xabar1",), ("xabar2",), ("xabar3",)]),  # message texts
        ],
        scalar_queue=[3],  # conversations
    )

    async def _fake_mood(messages):
        return ({"mood_trend": "barqaror", "mood_summary": "ok",
                 "topics": ["maktab"], "stress_signals": "", "highlight": ""}, True)
    monkeypatch.setattr(rpt, "_mood_section", _fake_mood)

    data = _run(rpt.build_report(db, child_id, now=now))

    assert data.period_end == now
    assert data.period_start == now - timedelta(days=rpt.REPORT_WINDOW_DAYS)
    assert data.llm_ok is True
    a = data.sections["activity"]
    assert a["active_days"] == 4 and a["total_messages"] == 12 and a["conversations"] == 3
    s = data.sections["safety"]
    assert s["concerning_count"] == 2  # yellow
    assert s["had_red"] is False
    assert data.sections["mood"]["mood_trend"] == "barqaror"


def test_build_report_privacy_no_text_leak(monkeypatch):
    """Privacy §11.3: raw message text must NOT appear in report sections."""
    child_id = uuid4()
    now = datetime(2026, 6, 1, tzinfo=UTC)
    secret = "MENING_MAXFIY_GAPIM"
    db = _FakeSession(
        execute_queue=[
            _Result([(5, 2)]),
            _Result([(CrisisLevel.GREEN, 5)]),
            _Result([(secret,), (secret,), (secret,)]),
        ],
        scalar_queue=[1],
    )

    async def _fake_mood(messages):
        # A correct mood pass aggregates; it must not echo raw text.
        return ({"mood_trend": "barqaror", "mood_summary": "umumiy xulosa",
                 "topics": [], "stress_signals": "", "highlight": ""}, True)
    monkeypatch.setattr(rpt, "_mood_section", _fake_mood)

    data = _run(rpt.build_report(db, child_id, now=now))
    assert secret not in str(data.sections)
