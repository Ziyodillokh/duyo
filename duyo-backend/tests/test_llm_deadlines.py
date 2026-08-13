"""No call that waits on the network may wait forever.

google-genai ships with NO default timeout. A request the API never answered
hung the whole chat turn: nginx recorded `POST /v1/chat 499 rt:68.4` — the
mobile client gave up after 60 seconds and the handler was still blocked. The
endpoint logs on completion, so a turn that never completed left no trace of
itself in the backend log at all, which is why it took production nginx logs
to find.

These tests pin the two halves of the fix: the client carries a timeout, and
crisis screening that blows its budget falls back to Layer 1 instead of
stalling a child's reply.
"""

from __future__ import annotations

import asyncio
import inspect

import pytest

from duyo.api.v1 import chat as chat_api
from duyo.core.config import get_settings
from duyo.models.crisis_event import CrisisLevel, highest
from duyo.services import gemini as gemini_service


def test_the_client_is_constructed_with_a_request_timeout():
    """Asserted against the source: constructing a real client needs an API
    key, and the property that matters is that the timeout is passed at all."""
    source = inspect.getsource(gemini_service.get_client)
    assert "http_options" in source
    assert "timeout=" in source
    assert "gemini_request_timeout_ms" in source


def test_the_timeout_is_configured_and_sane():
    timeout_ms = get_settings().gemini_request_timeout_ms
    assert timeout_ms > 0
    # Must sit under the mobile client's own 60s ceiling, so the SERVER
    # decides to fall back rather than the child watching a spinner until the
    # app gives up. See duyo-mobile/src/api/client.ts.
    assert timeout_ms < 60_000


def test_the_crisis_budget_leaves_room_for_a_reply():
    """Screening must never eat the whole request. Layer 1 has already run
    locally, so waiting longer buys an escalation at the cost of the answer."""
    assert chat_api._CRISIS_BUDGET_S < chat_api._REPLY_BUDGET_S


def test_the_reply_budget_sits_under_the_client_ceiling():
    """The mobile client waits 60s; the server must give up first, with a
    real sentence, rather than being cut off mid-turn."""
    assert chat_api._REPLY_BUDGET_S < 60.0


def test_crisis_screening_has_a_deadline_and_falls_back_to_layer_one():
    source = inspect.getsource(chat_api.chat_turn)
    block = source[source.index("_CRISIS_BUDGET_S") - 400:]
    assert "asyncio.wait_for" in block
    assert "TimeoutError" in block
    # The fallback keeps Layer 1's level rather than inventing GREEN.
    assert "level=l1_level" in block


def test_a_timed_out_screening_can_only_lose_an_escalation():
    """The safety property, stated directly.

    Falling back to Layer 1 means the final level equals L1. Since every layer
    is escalate-only, that is always <= what a completed screening would have
    produced — a timeout can miss an escalation, and can never produce a
    downgrade below what Layer 1 already found.
    """
    for l1 in CrisisLevel:
        timed_out = highest(l1, l1, l1)
        assert timed_out is l1
        for l2 in CrisisLevel:
            for l3 in CrisisLevel:
                completed = highest(l1, l2, l3)
                # A completed screening is never LOWER than the timeout path.
                assert completed is highest(completed, timed_out)


def test_a_hung_call_becomes_a_timeout_not_a_hang():
    """wait_for is what turns an unbounded wait into a path every caller
    already handles."""

    async def never_answers():
        await asyncio.Event().wait()

    async def scenario():
        with pytest.raises(TimeoutError):
            await asyncio.wait_for(never_answers(), timeout=0.05)

    asyncio.run(scenario())


def test_the_conversation_vanishing_mid_turn_is_handled():
    """A slow turn plus a child deleting that conversation from the history
    list produced StaleDataError and a 500. The reply is real by then; losing
    it because its folder went away is the wrong trade."""
    source = inspect.getsource(chat_api.chat_turn)
    assert "StaleDataError" in source
    tail = source[source.index("StaleDataError"):]
    assert "rollback" in tail
    assert "return ChatResponse" in tail


def test_phases_are_logged_as_they_finish():
    """A turn that never finishes never reaches the summary line — which is
    precisely the turn worth diagnosing."""
    source = inspect.getsource(chat_api.chat_turn)
    mark = source[source.index("def _mark"):source.index("def _mark") + 600]
    assert "log.warning" in mark
    assert "chat_phase" in mark
