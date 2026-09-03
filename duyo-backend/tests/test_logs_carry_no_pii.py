"""The container log is not a second store of personal data.

Docker/journald logs on the VPS have no retention policy, no access control
past shell access, and no mention in any Data safety declaration. What was
going into them: parent phone numbers on the crisis path, the first sixty
characters of what a child typed, and — whenever the SMS stub was active — the
login code itself, in cleartext.

These assert the shape of the log line rather than a formatted string, because
what matters is which arguments reach the handler at all.
"""

from __future__ import annotations

import asyncio
import importlib
import inspect
import logging
from uuid import uuid4

import pytest

from duyo.crisis.detector import CrisisLevel
from duyo.services import sms as sms_module

_PHONE = "+998901234567"


def _run(coro):
    # asyncio.run, not get_event_loop(): these are sync tests in a suite that
    # closes loops around them, and which loop is "current" by the time they
    # run is ordering, not intent.
    return asyncio.run(coro)


@pytest.fixture
def captured(caplog):
    caplog.set_level(logging.DEBUG)
    return caplog


def _rendered(caplog) -> str:
    return "\n".join(r.getMessage() for r in caplog.records)


def test_the_sms_stub_never_prints_the_code_it_is_standing_in_for(captured):
    """The body of an OTP message IS a working credential."""
    _run(sms_module.StubSMSProvider().send(_PHONE, "DUYO kodingiz: 54321"))
    rendered = _rendered(captured)
    assert "54321" not in rendered
    assert _PHONE not in rendered


def test_the_crisis_dispatch_names_the_child_not_the_parents_phone(captured, monkeypatch):
    from duyo.api.v1 import chat as chat_module

    class _Accepts:
        async def send(self, _phone, _message):
            return True

    monkeypatch.setattr(chat_module, "get_sms_provider", lambda: _Accepts())
    child_id = uuid4()
    _run(chat_module._dispatch_parent_alert(_PHONE, "Aziza", CrisisLevel.RED, child_id))

    rendered = _rendered(captured)
    assert _PHONE not in rendered
    assert "Aziza" not in rendered
    assert str(child_id) in rendered


def test_the_voice_crisis_dispatch_does_the_same(captured, monkeypatch):
    from duyo.api.v1 import voice as voice_module

    class _Accepts:
        async def send(self, _phone, _message):
            return True

    monkeypatch.setattr(voice_module.sms_module, "get_sms_provider", lambda: _Accepts())
    child_id = uuid4()
    _run(voice_module._send_parent_sms(_PHONE, "Aziza", CrisisLevel.RED, child_id))

    rendered = _rendered(captured)
    assert _PHONE not in rendered
    assert "Aziza" not in rendered


@pytest.mark.parametrize(
    "module_path",
    ["duyo.psychology.retriever", "duyo.textbook.retriever", "duyo.api.v1.textbook"],
)
def test_no_retrieval_log_line_carries_what_the_child_typed(module_path):
    """A homework question and an emotional-topic opener are both the child's
    own words. Asserted on the source because these lines are on paths that
    need a database and an embedding API to reach."""
    source = inspect.getsource(importlib.import_module(module_path))
    for forbidden in ("query=q[", "query=query[", "query=normalized[", "message=child_message["):
        assert forbidden not in source
