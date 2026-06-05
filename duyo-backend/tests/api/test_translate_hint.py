"""Voice-screen translate + hint endpoints."""

import asyncio
from dataclasses import dataclass
from uuid import uuid4

from duyo.api.v1 import chat as chat_module
from duyo.models.child import AgeSegment
from duyo.schemas.chat import HintRequest, TranslateRequest


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
    c.age_segment = AgeSegment.JUNIOR
    return c


def test_translate_returns_translation(monkeypatch):
    async def _fake(*, text, target_lang):
        assert text == "salom"
        assert target_lang == "ru"
        return "перевод"
    monkeypatch.setattr(chat_module, "translate_text", _fake)
    resp = _run(chat_module.translate(
        payload=TranslateRequest(text="salom", target_lang="ru"),
        _current_user=_User(uuid4()),
    ))
    assert resp.translated == "перевод"


def test_hint_returns_suggestion(monkeypatch):
    user = _User(uuid4())
    child = _child(user.id)
    async def _fake(*, context, age_segment):
        assert context == ""
        assert age_segment == AgeSegment.JUNIOR
        return "Sevimli hayvoning haqida so'ra"
    monkeypatch.setattr(chat_module, "suggest_hint", _fake)
    resp = _run(chat_module.hint(
        payload=HintRequest(child_id=child.id, context=""),
        current_user=user,
        db=_FakeSession(child=child),
    ))
    assert "so'ra" in resp.hint
