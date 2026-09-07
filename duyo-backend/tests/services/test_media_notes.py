"""Transcription is a safety screen, so an empty answer is not a pass.

`transcribe` is the ONLY thing that reads a clip before it is delivered to a
room of children. Its result decides whether the note is screened or refused,
and the dangerous case is subtle: Gemini returns a refusal — the safety layer
declining to transcribe abusive media — exactly the way it returns silence.
Both arrive as a response with no text.

Read as silence, the caller finds no words to screen and delivers the file. The
model declining BECAUSE the content is abusive would become the reason it
shipped. These tests pin the distinction.
"""

from __future__ import annotations

import pytest

from duyo.services import media_notes


class _Reason:
    """A finish_reason enum member — the SDK exposes `.name`."""

    def __init__(self, name: str):
        self.name = name


class _Candidate:
    def __init__(self, finish_reason):
        self.finish_reason = finish_reason


class _Feedback:
    def __init__(self, block_reason):
        self.block_reason = block_reason


class _Resp:
    def __init__(self, text="", finish="STOP", block=None):
        self.text = text
        self.candidates = [_Candidate(_Reason(finish) if finish else None)]
        self.prompt_feedback = _Feedback(block)


@pytest.fixture
def _stub(monkeypatch):
    """Replace the network call; each test supplies the response shape."""

    def install(resp):
        class _Models:
            async def generate_content(self, **_kw):
                return resp

        class _Aio:
            models = _Models()

        class _Client:
            aio = _Aio()

        monkeypatch.setattr(media_notes, "get_client", lambda: _Client())

    return install


async def test_a_transcript_comes_back_ok(_stub):
    _stub(_Resp(text="  Salom, kitobni tugatdim  "))

    result = await media_notes.transcribe(b"clip", "audio/webm")

    assert result.ok is True
    assert result.text == "Salom, kitobni tugatdim"


async def test_genuine_silence_still_passes(_stub):
    """A wordless wave must remain sendable.

    The model listened, finished normally and heard nothing. There is no
    refusal here and no reason to block the clip.
    """
    _stub(_Resp(text="", finish="STOP"))

    result = await media_notes.transcribe(b"clip", "audio/webm")

    assert result.ok is True
    assert result.text == ""


async def test_a_safety_refusal_is_a_failure_not_silence(_stub):
    """The case this module exists for.

    Gemini declined to transcribe. Before this, `ok` was True and the empty
    string read as "no words to screen", so the clip was delivered.
    """
    _stub(_Resp(text="", finish="SAFETY"))

    result = await media_notes.transcribe(b"clip", "audio/webm")

    assert result.ok is False
    assert "SAFETY" in (result.error or "")


async def test_a_blocked_prompt_is_a_failure(_stub):
    """Blocked before generation: no candidate ever carried words."""
    _stub(_Resp(text="", finish=None, block=_Reason("SAFETY")))

    result = await media_notes.transcribe(b"clip", "video/webm")

    assert result.ok is False
    assert "blocked" in (result.error or "")


async def test_a_truncated_response_still_counts_as_a_transcript(_stub):
    """MAX_TOKENS with words in it is a transcript, just a clipped one.

    Refusing here would block long clips for a reason that has nothing to do
    with safety.
    """
    _stub(_Resp(text="juda uzun gap", finish="MAX_TOKENS"))

    result = await media_notes.transcribe(b"clip", "audio/webm")

    assert result.ok is True
    assert result.text == "juda uzun gap"


async def test_the_network_failing_is_still_a_failure(monkeypatch):
    """Unchanged behaviour, asserted so the refactor cannot lose it."""

    def _boom():
        raise RuntimeError("no api key")

    monkeypatch.setattr(media_notes, "get_client", _boom)

    result = await media_notes.transcribe(b"clip", "audio/webm")

    assert result.ok is False
    assert result.text == ""
