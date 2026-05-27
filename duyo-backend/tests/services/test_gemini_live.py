"""Tests for GeminiVoiceSession — Gemini Live API wrapper.

These tests are also the living spec for which Live SDK message shapes
we translate into our LiveEvent domain model, and how the session
lifecycle (connect → activity_start → audio → activity_end → events →
turn_complete → close) is exposed.

Network is mocked end-to-end — no real Google call.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from types import SimpleNamespace
from typing import Any

import pytest

from duyo.services.gemini_live import (
    GeminiVoiceSession,
    LiveEvent,
    _parse_message,
)

# ---------------------------------------------------------------------------
# _parse_message — pure translation from SDK message to our LiveEvent(s)
# ---------------------------------------------------------------------------


def _msg(*, data: bytes | None = None, server_content: Any | None = None) -> Any:
    """Builds a minimal SimpleNamespace that quacks like LiveServerMessage."""
    return SimpleNamespace(data=data, server_content=server_content, text=None)


def _sc(**kwargs: Any) -> Any:
    """Builds a server_content namespace. Missing fields default to None/False."""
    defaults = {
        "input_transcription": None,
        "output_transcription": None,
        "generation_complete": False,
        "turn_complete": False,
        "interrupted": False,
    }
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def _tr(text: str) -> Any:
    return SimpleNamespace(text=text)


def test_empty_message_yields_no_events():
    msg = _msg()
    assert list(_parse_message(msg, elapsed_ms=100)) == []


def test_audio_data_yields_audio_event():
    msg = _msg(data=b"\x00\x01\x02\x03")
    events = list(_parse_message(msg, elapsed_ms=250))
    assert events == [LiveEvent(kind="audio", audio_data=b"\x00\x01\x02\x03", elapsed_ms=250)]


def test_empty_audio_data_is_ignored():
    msg = _msg(data=b"")
    assert list(_parse_message(msg, elapsed_ms=10)) == []


def test_input_transcription_yields_input_tr_event():
    msg = _msg(server_content=_sc(input_transcription=_tr("Salom")))
    events = list(_parse_message(msg, elapsed_ms=500))
    assert events == [LiveEvent(kind="input_tr", text="Salom", elapsed_ms=500)]


def test_output_transcription_yields_output_tr_event():
    msg = _msg(server_content=_sc(output_transcription=_tr(" maktab")))
    events = list(_parse_message(msg, elapsed_ms=1200))
    assert events == [LiveEvent(kind="output_tr", text=" maktab", elapsed_ms=1200)]


def test_empty_transcription_text_is_ignored():
    msg = _msg(server_content=_sc(input_transcription=_tr("")))
    assert list(_parse_message(msg, elapsed_ms=100)) == []


def test_generation_complete_flag_yields_event():
    msg = _msg(server_content=_sc(generation_complete=True))
    events = list(_parse_message(msg, elapsed_ms=3000))
    assert events == [LiveEvent(kind="gen_complete", elapsed_ms=3000)]


def test_turn_complete_flag_yields_event():
    msg = _msg(server_content=_sc(turn_complete=True))
    events = list(_parse_message(msg, elapsed_ms=4000))
    assert events == [LiveEvent(kind="turn_complete", elapsed_ms=4000)]


def test_combined_audio_and_output_transcription_yields_both():
    """SDK frequently bundles a PCM chunk and a transcript word in one msg."""
    msg = _msg(
        data=b"AUDIO",
        server_content=_sc(output_transcription=_tr(" salom")),
    )
    events = list(_parse_message(msg, elapsed_ms=900))
    assert events == [
        LiveEvent(kind="audio", audio_data=b"AUDIO", elapsed_ms=900),
        LiveEvent(kind="output_tr", text=" salom", elapsed_ms=900),
    ]


# ---------------------------------------------------------------------------
# GeminiVoiceSession — async-context-manager wraps a mocked SDK session
# ---------------------------------------------------------------------------


@dataclass
class _FakeSession:
    """A stand-in for `client.aio.live.connect(...)` session."""

    sent: list[Any] = field(default_factory=list)
    incoming: list[Any] = field(default_factory=list)

    async def send_realtime_input(self, **kwargs: Any) -> None:
        self.sent.append(kwargs)

    async def receive(self) -> AsyncIterator[Any]:
        for m in self.incoming:
            yield m


class _FakeClient:
    """Stand-in for genai.Client with `.aio.live.connect(...)` returning a CM."""

    def __init__(self, session: _FakeSession):
        self.session = session
        self.connect_kwargs: dict[str, Any] = {}

        @asynccontextmanager
        async def connect(**kwargs: Any) -> AsyncIterator[_FakeSession]:
            self.connect_kwargs = kwargs
            yield self.session

        self.aio = SimpleNamespace(live=SimpleNamespace(connect=connect))


@pytest.fixture
def fake_session() -> _FakeSession:
    return _FakeSession()


@pytest.fixture
def fake_client(fake_session: _FakeSession, monkeypatch: pytest.MonkeyPatch) -> _FakeClient:
    """Replace the cached real client with a fake — no network."""
    client = _FakeClient(fake_session)
    monkeypatch.setattr(
        "duyo.services.gemini_live._get_live_client", lambda: client
    )
    return client


@pytest.mark.asyncio
async def test_session_enters_and_exits_cleanly(fake_client, fake_session):
    async with GeminiVoiceSession(system_prompt="You are DUYO.") as session:
        assert session is not None
    # Connect was called with our chosen model + config — verify essentials.
    kwargs = fake_client.connect_kwargs
    assert "gemini" in kwargs["model"] and "live" in kwargs["model"]


@pytest.mark.asyncio
async def test_send_audio_chunks_forwards_pcm(fake_client, fake_session):
    async with GeminiVoiceSession(system_prompt="hi") as session:
        await session.start_activity()
        await session.send_audio(b"\x10\x20")
        await session.send_audio(b"\x30\x40")
        await session.end_activity()

    kinds = [list(call.keys())[0] for call in fake_session.sent]
    assert kinds == ["activity_start", "audio", "audio", "activity_end"]

    # PCM blobs are tagged with the expected mime type / rate.
    audio_calls = [c for c in fake_session.sent if "audio" in c]
    assert audio_calls[0]["audio"].data == b"\x10\x20"
    assert "audio/pcm" in audio_calls[0]["audio"].mime_type
    assert "16000" in audio_calls[0]["audio"].mime_type


@pytest.mark.asyncio
async def test_events_iterator_yields_parsed_events_until_turn_complete(
    fake_client, fake_session
):
    fake_session.incoming = [
        _msg(server_content=_sc(input_transcription=_tr("Salom"))),
        _msg(data=b"PCM1"),
        _msg(data=b"PCM2", server_content=_sc(output_transcription=_tr("salom"))),
        _msg(server_content=_sc(generation_complete=True)),
        _msg(server_content=_sc(turn_complete=True)),
        _msg(data=b"AFTER"),  # must NOT be yielded
    ]
    async with GeminiVoiceSession(system_prompt="hi") as session:
        kinds: list[str] = []
        audio_chunks: list[bytes] = []
        async for ev in session.events():
            kinds.append(ev.kind)
            if ev.kind == "audio":
                audio_chunks.append(ev.audio_data)

    assert kinds == [
        "input_tr",
        "audio",
        "audio",
        "output_tr",
        "gen_complete",
        "turn_complete",
    ]
    assert audio_chunks == [b"PCM1", b"PCM2"]


@pytest.mark.asyncio
async def test_session_records_elapsed_ms_monotonically(fake_client, fake_session):
    fake_session.incoming = [
        _msg(server_content=_sc(input_transcription=_tr("a"))),
        _msg(server_content=_sc(input_transcription=_tr("b"))),
        _msg(server_content=_sc(turn_complete=True)),
    ]
    async with GeminiVoiceSession(system_prompt="hi") as session:
        elapsed = [ev.elapsed_ms async for ev in session.events()]

    assert elapsed[0] >= 0
    assert all(elapsed[i] <= elapsed[i + 1] for i in range(len(elapsed) - 1))
