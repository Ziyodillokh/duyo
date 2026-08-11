"""Personal-memory candidate extraction — the server half of local-first memory.

The property that matters most here is a NEGATIVE one: this module must never
write anything anywhere. It has no database import at all (asserted below), so
a candidate the child has not consented to cannot survive the request that
produced it. The rest of these tests pin the fail-safe behaviour — every bad
model response, missing key or network error has to come back as None rather
than raise, because a broken extractor must never become a broken chat turn.
"""

from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass
from types import SimpleNamespace

import pytest

from duyo.services import memory_candidates as mod


def _run(coro):
    return asyncio.run(coro)


@dataclass
class _FakeResponse:
    text: str


class _FakeModels:
    """Stands in for client.aio.models; records the call and replays a canned reply."""

    def __init__(self, reply: str | Exception):
        self.reply = reply
        self.calls: list[dict] = []

    async def generate_content(self, **kwargs):
        self.calls.append(kwargs)
        if isinstance(self.reply, Exception):
            raise self.reply
        return _FakeResponse(text=self.reply)


def _client_with(reply: str | Exception) -> tuple[object, _FakeModels]:
    models = _FakeModels(reply)
    client = SimpleNamespace(aio=SimpleNamespace(models=models))
    return client, models


@pytest.fixture
def gemini(monkeypatch):
    """Patch get_client; returns a setter so each test picks its own reply."""

    def _set(reply: str | Exception) -> _FakeModels:
        client, models = _client_with(reply)
        monkeypatch.setattr(mod, "get_client", lambda: client)
        return models

    return _set


# --- the non-negotiable one --------------------------------------------------


def test_module_never_touches_the_database():
    """No DB import means a candidate cannot be persisted server-side.

    This is the architectural guarantee of the whole local-first design, and
    it is one careless import away from being lost — hence a test, not a
    comment. Compare services/goals.py, which deliberately DOES persist.
    """
    source = (mod.__file__ or "")
    assert source.endswith("memory_candidates.py")
    with open(source, encoding="utf-8") as fh:
        text = fh.read()
    for forbidden in ("get_session_factory", "AsyncSession", "duyo.models", "session.add"):
        assert forbidden not in text, f"{forbidden} must not appear in this module"


# --- happy path --------------------------------------------------------------


def test_extracts_a_research_fact(gemini):
    gemini(json.dumps({
        "has_memory": True,
        "category": "research",
        "content": "Bola AI agentlar bo'yicha ilmiy ish qilmoqda",
    }))
    result = _run(mod.extract_memory_candidate(
        "Men AI agentlar haqida ilmiy ish qilyapman"
    ))
    assert result is not None
    assert result.category == "research"
    assert result.content == "Bola AI agentlar bo'yicha ilmiy ish qilmoqda"


@pytest.mark.parametrize(
    "category", ["profile", "preferences", "interests", "learning", "research", "notes"]
)
def test_every_documented_category_is_accepted(gemini, category):
    gemini(json.dumps({"has_memory": True, "category": category, "content": "Bir fakt"}))
    result = _run(mod.extract_memory_candidate("Bir nima haqida gapirdim"))
    assert result is not None and result.category == category


def test_whitespace_is_collapsed_and_content_capped(gemini):
    gemini(json.dumps({
        "has_memory": True,
        "category": "notes",
        "content": "  ko'p    bo'sh\n\njoylar  " + "x" * 300,
    }))
    result = _run(mod.extract_memory_candidate("uzun bir gap yozdim bu yerda"))
    assert result is not None
    assert "\n" not in result.content
    assert "    " not in result.content
    assert len(result.content) <= mod._CONTENT_MAX


# --- refusals ----------------------------------------------------------------


def test_no_memory_returns_none(gemini):
    gemini(json.dumps({"has_memory": False}))
    assert _run(mod.extract_memory_candidate("sitoplazma nima degani?")) is None


def test_short_message_never_calls_the_model(gemini):
    """Below the length floor the API is not called at all — saves a call per 'ha'."""
    models = gemini(json.dumps({"has_memory": True, "category": "notes", "content": "x"}))
    assert _run(mod.extract_memory_candidate("rahmat")) is None
    assert models.calls == []


def test_blank_message_never_calls_the_model(gemini):
    models = gemini(json.dumps({"has_memory": True, "category": "notes", "content": "x"}))
    assert _run(mod.extract_memory_candidate("              ")) is None
    assert models.calls == []


def test_disabled_by_settings_never_calls_the_model(gemini, monkeypatch):
    """The ops kill switch must cut the call, not just discard its result."""
    models = gemini(json.dumps({"has_memory": True, "category": "notes", "content": "x"}))
    settings = mod.get_settings()
    monkeypatch.setattr(
        mod, "get_settings",
        lambda: SimpleNamespace(
            memory_candidate_extraction_enabled=False,
            gemini_model_primary=settings.gemini_model_primary,
            gemini_thinking_budget_flash=settings.gemini_thinking_budget_flash,
        ),
    )
    assert _run(mod.extract_memory_candidate("Men matematikani yaxshi ko'raman")) is None
    assert models.calls == []


# --- fail-safe ---------------------------------------------------------------


def test_unknown_category_is_rejected(gemini):
    """A category outside the documented set is a model error, not a new bucket."""
    gemini(json.dumps({"has_memory": True, "category": "medical", "content": "..."}))
    assert _run(mod.extract_memory_candidate("Men shifokorga bordim bugun")) is None


def test_goals_is_not_a_memory_category(gemini):
    """Goals have their own extractor and confirmation flow (services/goals.py)."""
    gemini(json.dumps({"has_memory": True, "category": "goals", "content": "..."}))
    assert _run(mod.extract_memory_candidate("Men kitob o'qimoqchiman bu yil")) is None


def test_too_short_content_is_rejected(gemini):
    gemini(json.dumps({"has_memory": True, "category": "notes", "content": "ha"}))
    assert _run(mod.extract_memory_candidate("Bir narsa aytmoqchiman senga")) is None


def test_non_json_response_returns_none(gemini):
    gemini("Kechirasiz, men buni tushunmadim.")
    assert _run(mod.extract_memory_candidate("Men matematikani yaxshi ko'raman")) is None


def test_json_array_response_returns_none(gemini):
    """Valid JSON of the wrong SHAPE must not crash the isinstance check."""
    gemini("[1, 2, 3]")
    assert _run(mod.extract_memory_candidate("Men matematikani yaxshi ko'raman")) is None


def test_empty_response_returns_none(gemini):
    gemini("")
    assert _run(mod.extract_memory_candidate("Men matematikani yaxshi ko'raman")) is None


def test_api_error_returns_none_and_does_not_raise(gemini):
    """A quota error or network blip must cost the memory prompt, never the reply."""
    gemini(RuntimeError("429 quota exceeded"))
    assert _run(mod.extract_memory_candidate("Men matematikani yaxshi ko'raman")) is None


def test_missing_api_key_returns_none(monkeypatch):
    """get_client() raises without GOOGLE_API_KEY — that must be swallowed too."""

    def _raise():
        raise RuntimeError("GOOGLE_API_KEY is not set")

    monkeypatch.setattr(mod, "get_client", _raise)
    assert _run(mod.extract_memory_candidate("Men matematikani yaxshi ko'raman")) is None


# --- request shape -----------------------------------------------------------


def test_extraction_is_deterministic_and_json_mode(gemini):
    """Extraction, not creativity: temperature 0 and a JSON-constrained response."""
    models = gemini(json.dumps({
        "has_memory": True, "category": "interests", "content": "Bola shaxmatga qiziqadi",
    }))
    _run(mod.extract_memory_candidate("Men shaxmat o'ynashni yaxshi ko'raman"))
    config = models.calls[0]["config"]
    assert config.temperature == 0.0
    assert config.response_mime_type == "application/json"
    assert config.system_instruction is mod.MEMORY_CANDIDATE_EXTRACT_PROMPT
