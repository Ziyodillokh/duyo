"""extract_goal_candidate — DUYO capturing a goal from conversation."""

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
    def __init__(self, existing=None):
        self._existing = existing or []
        self.added: list = []
        self.committed = False

    async def execute(self, _stmt):
        rows = self._existing
        return SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: rows))

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
    await goal_service.extract_goal_candidate(
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
    await goal_service.extract_goal_candidate(
        uuid4(), "Sitoplazma nima ekanini tushuntirib ber"
    )
    assert session.added == []


@pytest.mark.asyncio
async def test_short_utterance_skips_the_model(monkeypatch):
    def _explode():
        raise AssertionError("model must not be called for a short utterance")

    monkeypatch.setattr(goal_service, "get_client", _explode)
    await goal_service.extract_goal_candidate(uuid4(), "ha")


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
    await goal_service.extract_goal_candidate(
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
    await goal_service.extract_goal_candidate(
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
    await goal_service.extract_goal_candidate(
        uuid4(), "Yana bitta yangi maqsad qo'ymoqchiman"
    )
    assert session.added == []


@pytest.mark.asyncio
async def test_model_error_is_swallowed(monkeypatch):
    """A chat turn must never fail because goal capture did."""
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
    await goal_service.extract_goal_candidate(
        uuid4(), "Bir kitob o'qimoqchiman albatta"
    )
    assert session.added == []
