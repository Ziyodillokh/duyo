"""The failure that hid twice, made to announce itself.

Thinking is spent out of `max_output_tokens` on these models, so a structured
call's characteristic failure is a correct answer cut off mid-object. The
generic JSONDecodeError that follows was swallowed by a blanket except at both
call sites, and the result looked like "the feature does not work" rather than
like an error:

  * the chalkboard stopped appearing on the problems it was wanted for
  * the brain map stopped growing from conversation

These pin the behaviour that makes the third time loud instead.
"""

from __future__ import annotations

import logging

from duyo.services.gemini import parse_structured


class _Finish:
    def __init__(self, name: str) -> None:
        self.name = name


class _Candidate:
    def __init__(self, finish: str | None) -> None:
        self.finish_reason = _Finish(finish) if finish else None


class _Resp:
    """The shape google-genai hands back, reduced to what is read."""

    def __init__(self, text: str | None, finish: str | None = "STOP") -> None:
        self.text = text
        self.candidates = [_Candidate(finish)]


def test_a_whole_object_comes_back_parsed():
    resp = _Resp('{"has_goal": true, "title": "O\'tkan kunlar"}')
    assert parse_structured(resp, where="t") == {
        "has_goal": True,
        "title": "O'tkan kunlar",
    }


def test_a_truncated_reply_is_reported_as_a_budget_problem(caplog):
    """The whole point: MAX_TOKENS must not read as malformed JSON.

    The text here is exactly what a cut-off reply looks like — valid JSON up
    to the point the budget ran out.
    """
    resp = _Resp('{"has_goal": true, "title": "O\'tkan ku', finish="MAX_TOKENS")

    with caplog.at_level(logging.ERROR):
        assert parse_structured(resp, where="insight_extract") is None

    logged = caplog.text
    assert "insight_extract" in logged
    # The message has to name the fix, not just the symptom — this is the
    # line someone reads at 2am wondering why a feature went quiet.
    assert "max_output_tokens" in logged
    assert "thinking_budget" in logged


def test_truncation_is_checked_before_the_text_is_parsed():
    """A cut-off reply that happens to still parse is STILL truncated.

    The model can run out of budget exactly on a closing brace. The object
    would load, and be missing whatever came after — so finish_reason wins
    over a successful parse.
    """
    resp = _Resp('{"has_goal": true}', finish="MAX_TOKENS")
    assert parse_structured(resp, where="t") is None


def test_malformed_json_is_still_reported_separately(caplog):
    resp = _Resp("not json at all")
    with caplog.at_level(logging.ERROR):
        assert parse_structured(resp, where="t") is None
    assert "not valid JSON" in caplog.text


def test_an_empty_reply_says_so_with_its_finish_reason(caplog):
    resp = _Resp("", finish="SAFETY")
    with caplog.at_level(logging.WARNING):
        assert parse_structured(resp, where="t") is None
    assert "SAFETY" in caplog.text


def test_a_json_array_is_not_an_object():
    """Callers do `data.get(...)`; a list would raise AttributeError there."""
    assert parse_structured(_Resp('["a", "b"]'), where="t") is None


def test_a_response_with_no_candidates_does_not_raise():
    """Defensive: the SDK can hand back a response with nothing in it."""
    resp = _Resp('{"ok": true}')
    resp.candidates = []
    assert parse_structured(resp, where="t") == {"ok": True}
