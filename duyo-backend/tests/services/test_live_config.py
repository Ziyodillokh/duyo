"""The setup message the Live API will actually accept.

On 7 September a `safety_settings=SAFETY_SETTINGS` was added to
`LiveConnectConfig`, matching what the text paths do. google-genai accepted
the argument, serialised it, and every local check passed — but the Live
endpoint has no such field in its `setup` message and does not ignore the
extra key. It closes the socket:

    1007 (invalid frame payload data)
    Invalid JSON payload received. Unknown name "safetySettings" at 'setup':
    Cannot find field.

Voice mode was dead for six days and nothing in the suite noticed, because
the rejection only exists on the wire. These tests stand in for the wire:
they build the real config through the real code path, with the client
faked out, and assert the shape the API accepts.

If a future change needs a field the SDK allows, check it against the Live
API before trusting that it is merely ignored.
"""

from __future__ import annotations

import asyncio
from typing import Any

import pytest

from duyo.services import gemini_live


class _FakeLiveCM:
    """Stands in for `client.aio.live.connect(...)`; yields a dummy session."""

    async def __aenter__(self) -> object:
        return object()

    async def __aexit__(self, *_: Any) -> None:
        return None


class _FakeLive:
    def __init__(self) -> None:
        self.captured: Any = None
        self.model: str | None = None

    def connect(self, *, model: str, config: Any) -> _FakeLiveCM:
        self.model = model
        self.captured = config
        return _FakeLiveCM()


class _FakeClient:
    def __init__(self, live: _FakeLive) -> None:
        self.aio = type("aio", (), {"live": live})()


@pytest.fixture
def captured_config(monkeypatch) -> Any:
    """The LiveConnectConfig the session would send, without sending it."""
    live = _FakeLive()
    monkeypatch.setattr(gemini_live, "_get_live_client", lambda: _FakeClient(live))

    async def _open() -> None:
        session = gemini_live.GeminiVoiceSession(system_prompt="SYSTEM PROMPT HERE")
        await session.__aenter__()
        await session.__aexit__(None, None, None)

    # asyncio.run, not an async test: sibling files in this suite reach for
    # get_event_loop(), and an async test here closes the loop out from under
    # them when the whole suite runs in one process.
    asyncio.run(_open())
    return live.captured


def test_the_live_setup_carries_no_safety_settings(captured_config):
    """The field the Live API rejects with 1007 must not be on the config."""

    assert getattr(captured_config, "safety_settings", None) is None


def test_the_system_prompt_still_reaches_the_model(captured_config):
    """Removing safety_settings must not remove what replaced it.

    The child-safety rules ride on the system instruction now, so an empty
    one would mean a live session with no safety framing at all.
    """

    instruction = captured_config.system_instruction
    assert instruction is not None
    assert "SYSTEM PROMPT HERE" in "".join(p.text or "" for p in instruction.parts)


def test_both_transcripts_are_requested(captured_config):
    """Input and output transcription are the record of what was said.

    They are the only per-turn evidence a live session leaves behind, which
    is what the safety review relies on now that thresholds cannot be set.
    """

    assert captured_config.input_audio_transcription is not None
    assert captured_config.output_audio_transcription is not None
