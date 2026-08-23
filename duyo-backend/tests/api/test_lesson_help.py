"""Lesson-help tutor endpoint — structured step-by-step solution."""

import asyncio
from dataclasses import dataclass
from uuid import uuid4

from duyo.api.v1 import chat as chat_module
from duyo.models.child import AgeSegment
from duyo.schemas.chat import LessonHelpRequest


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


@dataclass
class _Result:
    _v: object
    def scalar_one_or_none(self):
        return self._v


@dataclass
class _FakeSession:
    child: object
    async def execute(self, *_a, **_kw):
        return _Result(self.child)


@dataclass
class _User:
    id: object


def _child(parent_id):
    c = type("C", (), {})()
    c.id = uuid4()
    c.parent_id = parent_id
    c.age_segment = AgeSegment.EXPLORER
    return c


def test_lesson_help_returns_steps_and_answer(monkeypatch):
    user = _User(uuid4())
    child = _child(user.id)
    db = _FakeSession(child=child)

    async def _fake_solve(*, question, subject, age_segment):
        assert question == "2x=8"
        assert subject == "matematika"
        assert age_segment == AgeSegment.EXPLORER
        return {"steps": [{"title": "1-qadam", "detail": "tushuntirish"}], "answer": "x=4"}
    monkeypatch.setattr(chat_module, "solve_lesson", _fake_solve)

    resp = _run(chat_module.lesson_help(
        payload=LessonHelpRequest(child_id=child.id, subject="matematika", question="2x=8"),
        current_user=user,
        db=db,
    ))
    assert resp.answer == "x=4"
    assert len(resp.steps) == 1
    assert resp.steps[0].title == "1-qadam"
    # A solve_lesson result with no "available" key is a real answer.
    assert resp.available is True


def test_lesson_help_degrades_when_model_unreachable(monkeypatch):
    """No GOOGLE_API_KEY must not reach the child as a 500 traceback.

    `get_client()` used to be called before solve_lesson's try, so a missing
    key raised RuntimeError straight out of the endpoint and the screen showed
    a raw Python stack trace. The main chat path has always answered with a
    friendly Uzbek fallback instead; this asserts lesson-help now matches it.
    """
    from duyo.services import gemini

    user = _User(uuid4())
    child = _child(user.id)
    db = _FakeSession(child=child)

    monkeypatch.setattr(gemini, "get_settings", lambda: type("S", (), {
        "google_api_key": "", "gemini_model_primary": "x",
        "gemini_thinking_budget_flash": 0,
    })())
    # get_client is @lru_cache'd — an earlier test may have built a real one.
    gemini.get_client.cache_clear()

    resp = _run(chat_module.lesson_help(
        payload=LessonHelpRequest(child_id=child.id, subject="matematika", question="2x=8"),
        current_user=user,
        db=db,
    ))
    assert resp.available is False
    assert resp.answer == ""
    # Something calm to read, never an empty screen.
    assert resp.steps and resp.steps[0].detail
