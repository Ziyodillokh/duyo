"""Parent guidance tests (Concept §5) — LLM mocked, privacy preserved."""

import asyncio

from duyo.analysis import guidance as g


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


_SECTIONS = {
    "activity": {"active_days": 4, "total_messages": 12, "conversations": 3, "window_days": 10},
    "mood": {"mood_trend": "tushkun", "mood_summary": "charchoq sezildi",
             "topics": ["maktab"], "stress_signals": "biroz charchoq", "highlight": ""},
    "safety": {"by_level": {"green": 10}, "concerning_count": 1, "had_red": False},
}


def test_too_little_activity_returns_empty():
    sections = {**_SECTIONS, "activity": {**_SECTIONS["activity"], "total_messages": 2}}
    out = _run(g.build_guidance(10, sections))
    assert out == g._EMPTY_GUIDANCE


def test_llm_failure_returns_empty(monkeypatch):
    def _boom():
        raise RuntimeError("api down")
    monkeypatch.setattr(g, "get_client", _boom)
    out = _run(g.build_guidance(10, _SECTIONS))
    assert out == g._EMPTY_GUIDANCE


def test_parses_and_caps_tips(monkeypatch):
    class _Resp:
        text = (
            '{"tips":["bir","ikki","uch","tort","besh","olti"],'
            '"focus":"hordiq"}'
        )

    class _Models:
        async def generate_content(self, **_kw):
            return _Resp()

    class _Client:
        aio = type("A", (), {"models": _Models()})()

    monkeypatch.setattr(g, "get_client", lambda: _Client())
    out = _run(g.build_guidance(10, _SECTIONS))
    assert out["focus"] == "hordiq"
    assert len(out["tips"]) == 4  # capped at 4
    assert out["tips"][0] == "bir"


def test_payload_contains_no_raw_messages():
    """Guidance payload is built from aggregates only — never raw text."""
    payload = g._build_payload(10, _SECTIONS, None)
    # Aggregate fields present...
    assert "Kayfiyat yo'nalishi: tushkun" in payload
    assert "Faol kunlar: 4/10" in payload
    # ...and the payload is short (no message dump)
    assert len(payload) < 600


def test_rag_context_is_injected():
    payload = g._build_payload(10, _SECTIONS, "Pedagogik tavsiya: ...")
    assert "[PEDAGOGIK MANBA]" in payload
    assert "Pedagogik tavsiya" in payload
