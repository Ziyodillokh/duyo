"""DTM question generation — grounded in textbook chunks, validated output."""

import json
from types import SimpleNamespace

from duyo.services import dtm as dtm_module


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
    def __init__(self, chunks):
        self._chunks = chunks
    async def execute(self, *_a, **_kw):
        return _Result(self._chunks)


def _fake_client(payload_text):
    class _Models:
        async def generate_content(self, **_kw):
            return SimpleNamespace(text=payload_text)
    return SimpleNamespace(aio=SimpleNamespace(models=_Models()))


async def test_returns_only_valid_questions(monkeypatch):
    payload = json.dumps({"questions": [
        {"text": "2+2=?", "choices": ["3", "4", "5", "6"], "correct_index": 1, "explanation": "4"},
        {"text": "bad", "choices": ["one"], "correct_index": 0},          # too few choices
        {"text": "oor", "choices": ["a", "b"], "correct_index": 9},        # index out of range
    ]})
    monkeypatch.setattr(dtm_module, "get_client", lambda: _fake_client(payload))
    qs = await dtm_module.generate_questions(_FakeSession(["darslik matni"]), subject="matematika")
    assert len(qs) == 1
    assert qs[0]["text"] == "2+2=?"
    assert qs[0]["correct_index"] == 1


async def test_no_chunks_returns_empty():
    qs = await dtm_module.generate_questions(_FakeSession([]), subject="yoq")
    assert qs == []


async def test_gemini_error_returns_empty(monkeypatch):
    def _boom():
        raise RuntimeError("no api key")
    monkeypatch.setattr(dtm_module, "get_client", _boom)
    qs = await dtm_module.generate_questions(_FakeSession(["matn"]), subject="matematika")
    assert qs == []
