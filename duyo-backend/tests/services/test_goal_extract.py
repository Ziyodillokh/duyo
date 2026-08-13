"""extract_child_insights — DUYO capturing a goal + style signal from conversation.

One combined Gemini call now covers both a stated goal and a style/interest
hint (`prompts.py::INSIGHT_EXTRACT_PROMPT`); the goal-side tests below are
unchanged from when this was `extract_goal_candidate` — none of their JSON
fixtures include a "style" key, so the style half is a no-op for them and
behaviour is identical. The style-forwarding tests at the bottom cover the
new combined behaviour; the merge logic itself is tested in
`test_style_profile.py`.
"""

from types import SimpleNamespace
from uuid import uuid4

import pytest

from duyo.models.goal import GoalStatus
from duyo.services import goals as goal_service


def _client(payload: str):
    class _Models:
        async def generate_content(self, **_kwargs):
            return SimpleNamespace(text=payload)

    return SimpleNamespace(aio=SimpleNamespace(models=_Models()))


class _Session:
    def __init__(self, existing=None, child_age: int | None = 12):
        self._existing = existing or []
        self._child_age = child_age
        self.added: list = []
        self.committed = False

    async def execute(self, _stmt):
        rows = self._existing
        return SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: rows))

    async def scalar(self, _stmt):
        """Only ever asked for the child's age, to apply the catalogue's own
        age band when resolving a match_key (services/goal_matching.py)."""
        return self._child_age

    def add(self, obj):
        self.added.append(obj)

    async def commit(self):
        self.committed = True

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_):
        return False


def _install(monkeypatch, payload: str, session: _Session):
    monkeypatch.setattr(goal_service, "get_client", lambda: _client(payload))
    monkeypatch.setattr(goal_service, "get_session_factory", lambda: (lambda: session))


def _goal(title: str, current=None, total=None):
    return SimpleNamespace(
        id=uuid4(),
        title=title,
        status=GoalStatus.ACTIVE,
        current_unit=current,
        total_units=total,
        progress_pct=None,
    )


@pytest.mark.asyncio
async def test_stated_goal_is_captured_unconfirmed(monkeypatch):
    session = _Session()
    _install(
        monkeypatch,
        '{"has_goal": true, "kind": "book", "title": "O\'tkan Kunlarni o\'qish",'
        ' "unit_label": "bet", "total_units": 250, "progress_value": null}',
        session,
    )
    await goal_service.extract_child_insights(
        uuid4(), "O'tkan Kunlar romanini o'qimoqchiman"
    )
    assert len(session.added) == 1
    saved = session.added[0]
    assert saved.title == "O'tkan Kunlarni o'qish"
    # The whole safety property: DUYO must not talk about a goal it inferred
    # until the child confirms it.
    assert saved.confirmed_at is None
    assert saved.source.value == "inferred"


@pytest.mark.asyncio
async def test_plain_question_captures_nothing(monkeypatch):
    session = _Session()
    _install(monkeypatch, '{"has_goal": false}', session)
    await goal_service.extract_child_insights(
        uuid4(), "Sitoplazma nima ekanini tushuntirib ber"
    )
    assert session.added == []


@pytest.mark.asyncio
async def test_short_utterance_skips_the_model(monkeypatch):
    def _explode():
        raise AssertionError("model must not be called for a short utterance")

    monkeypatch.setattr(goal_service, "get_client", _explode)
    await goal_service.extract_child_insights(uuid4(), "ha")


@pytest.mark.asyncio
async def test_progress_updates_an_existing_goal(monkeypatch):
    existing = _goal("O'tkan Kunlarni o'qish", current=5, total=250)
    session = _Session([existing])
    _install(
        monkeypatch,
        '{"has_goal": true, "kind": "book", "title": "O\'tkan Kunlar",'
        ' "unit_label": "bet", "total_units": null, "progress_value": 42}',
        session,
    )
    await goal_service.extract_child_insights(
        uuid4(), "O'tkan Kunlarning 42-betidaman"
    )
    assert existing.current_unit == 42
    assert existing.progress_pct == 16.8
    # An event row, not a second goal.
    assert len(session.added) == 1
    assert session.added[0].unit_value == 42


@pytest.mark.asyncio
async def test_progress_never_goes_backwards(monkeypatch):
    existing = _goal("Fizika darsligi", current=90, total=200)
    session = _Session([existing])
    _install(
        monkeypatch,
        '{"has_goal": true, "kind": "textbook", "title": "Fizika darsligi",'
        ' "unit_label": "bet", "total_units": null, "progress_value": 12}',
        session,
    )
    await goal_service.extract_child_insights(
        uuid4(), "Fizika darsligining 12-betini qayta o'qidim"
    )
    assert existing.current_unit == 90
    assert session.added == []


@pytest.mark.asyncio
async def test_goal_cap_stops_runaway_capture(monkeypatch):
    session = _Session([_goal(f"maqsad {i}") for i in range(12)])
    _install(
        monkeypatch,
        '{"has_goal": true, "kind": "other", "title": "yana bitta maqsad",'
        ' "unit_label": null, "total_units": null, "progress_value": null}',
        session,
    )
    await goal_service.extract_child_insights(
        uuid4(), "Yana bitta yangi maqsad qo'ymoqchiman"
    )
    assert session.added == []


@pytest.mark.asyncio
async def test_model_error_is_swallowed(monkeypatch):
    """A chat turn must never fail because insight capture did."""
    class _Boom:
        async def generate_content(self, **_kwargs):
            raise RuntimeError("gemini down")

    session = _Session()
    monkeypatch.setattr(
        goal_service,
        "get_client",
        lambda: SimpleNamespace(aio=SimpleNamespace(models=_Boom())),
    )
    monkeypatch.setattr(goal_service, "get_session_factory", lambda: (lambda: session))
    await goal_service.extract_child_insights(
        uuid4(), "Bir kitob o'qimoqchiman albatta"
    )
    assert session.added == []


# ---------------------------------------------------------------------------
# Combined extraction — the "style" half of the same JSON response.
# services/style_profile.py has its own tests for the merge logic itself;
# these only check that extract_child_insights actually forwards it, and
# that the two halves stay independent of each other's failures.
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_style_signal_is_forwarded_even_without_a_goal(monkeypatch):
    session = _Session()
    _install(
        monkeypatch,
        '{"has_goal": false, "style": {"length_pref": "short", '
        '"interests": ["futbol"]}}',
        session,
    )
    calls = []

    async def _fake_merge(child_id, style):
        calls.append((child_id, style))

    monkeypatch.setattr(goal_service, "merge_style_signal", _fake_merge)
    child_id = uuid4()
    await goal_service.extract_child_insights(child_id, "Futbol juda qiziq, qisqa yozaman")
    assert calls == [(child_id, {"length_pref": "short", "interests": ["futbol"]})]
    assert session.added == []  # no goal in this message


@pytest.mark.asyncio
async def test_goal_and_style_both_captured_from_one_model_call(monkeypatch):
    session = _Session()
    _install(
        monkeypatch,
        '{"has_goal": true, "kind": "habit", "title": "Har kuni sport qilish",'
        ' "unit_label": null, "total_units": null, "progress_value": null,'
        ' "style": {"humor_pref": "high"}}',
        session,
    )
    calls = []

    async def _fake_merge(child_id, style):
        calls.append((child_id, style))

    monkeypatch.setattr(goal_service, "merge_style_signal", _fake_merge)
    await goal_service.extract_child_insights(uuid4(), "Har kuni sport qilmoqchiman, zo'r-a!")
    assert len(session.added) == 1  # the goal
    assert calls[0][1] == {"humor_pref": "high"}  # the style signal


@pytest.mark.asyncio
async def test_style_merge_failure_never_blocks_goal_persistence(monkeypatch):
    """The two halves are independent: a broken style merge must not lose the goal."""
    session = _Session()
    _install(
        monkeypatch,
        '{"has_goal": true, "kind": "book", "title": "Kitob o\'qish",'
        ' "unit_label": null, "total_units": null, "progress_value": null,'
        ' "style": {"length_pref": "short"}}',
        session,
    )

    async def _boom(*_args):
        raise RuntimeError("style profile db down")

    monkeypatch.setattr(goal_service, "merge_style_signal", _boom)
    await goal_service.extract_child_insights(uuid4(), "Bir kitob o'qimoqchiman albatta")
    assert len(session.added) == 1  # goal still captured despite the style-merge blowing up


@pytest.mark.asyncio
async def test_no_style_key_never_calls_the_merger(monkeypatch):
    """Existing (pre-combined-prompt) response shape must still work untouched."""
    session = _Session()
    _install(monkeypatch, '{"has_goal": false}', session)

    def _explode(*_args):
        raise AssertionError("merge_style_signal must not run with no style data")

    monkeypatch.setattr(goal_service, "merge_style_signal", _explode)
    await goal_service.extract_child_insights(uuid4(), "Bugun charchadim juda ko'p")
