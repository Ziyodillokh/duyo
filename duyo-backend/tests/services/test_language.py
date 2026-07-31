"""Language-practice question generation — grounded or free, validated output."""

import json
from types import SimpleNamespace

from duyo.models.child import AgeSegment
from duyo.services import language as language_module


class _Scalars:
    def __init__(self, v):
        self._v = v

    def all(self):
        return self._v


class _Result:
    def __init__(self, v):
        self._v = v

    def scalars(self):
        return _Scalars(self._v)


class _FakeSession:
    def __init__(self, bodies):
        self._bodies = bodies

    async def execute(self, *_a, **_kw):
        return _Result(self._bodies)


def _fake_client(payload_text):
    class _Models:
        async def generate_content(self, **_kw):
            return SimpleNamespace(text=payload_text)
    return SimpleNamespace(aio=SimpleNamespace(models=_Models()))


async def test_returns_only_valid_questions(monkeypatch):
    payload = json.dumps({"questions": [
        {"text": "Cat = ?", "choices": ["mushuk", "it", "sichqon", "quyon"],
         "correct_index": 0, "explanation": "Cat — mushuk"},
        {"text": "bad", "choices": ["one"], "correct_index": 0},          # too few choices
        {"text": "oor", "choices": ["a", "b"], "correct_index": 9},        # index out of range
    ]})
    monkeypatch.setattr(language_module, "get_client", lambda: _fake_client(payload))
    qs = await language_module.generate_practice(
        _FakeSession(["darslik matni"]), language="en", age_segment=AgeSegment.EXPLORER,
    )
    assert len(qs) == 1
    assert qs[0]["text"] == "Cat = ?"
    assert qs[0]["correct_index"] == 0


async def test_generates_without_grounding_material(monkeypatch):
    """No published ContentItem for this language — still generates from the topic."""
    payload = json.dumps({"questions": [
        {"text": "Dog = ?", "choices": ["it", "mushuk", "ot", "sigir"],
         "correct_index": 0, "explanation": "Dog — it"},
    ]})
    monkeypatch.setattr(language_module, "get_client", lambda: _fake_client(payload))
    qs = await language_module.generate_practice(
        _FakeSession([]), language="en", age_segment=AgeSegment.JUNIOR, topic="hayvonlar",
    )
    assert len(qs) == 1
    assert qs[0]["text"] == "Dog = ?"


async def test_gemini_error_returns_empty(monkeypatch):
    def _boom():
        raise RuntimeError("no api key")
    monkeypatch.setattr(language_module, "get_client", _boom)
    qs = await language_module.generate_practice(
        _FakeSession(["matn"]), language="ru", age_segment=AgeSegment.COMPANION,
    )
    assert qs == []
