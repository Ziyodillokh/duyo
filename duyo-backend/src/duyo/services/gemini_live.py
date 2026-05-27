"""Gemini Live API session wrapper for voice mode (D-005 v3).

Wraps `google-genai`'s bidirectional Live session so the rest of the app
can deal in a small, typed event stream instead of raw SDK message
shapes. One instance == one voice turn.

Why a class and not free functions: callers need an async context
manager (`async with`) to guarantee the underlying WebSocket is closed
even when an exception interrupts a turn. The SDK already exposes a
context manager via `client.aio.live.connect(...)`; this class is a thin
adapter that adds:

  - DUYO-specific defaults (manual VAD, dual-direction transcription)
  - A pure `_parse_message` translation step so the consumer never
    touches SDK types directly
  - An `events()` async iterator that stops at `turn_complete`, so the
    consumer doesn't have to track the lifecycle by hand

Refer to `scripts/poc_gemini_live_uzbek.py` for the experimental script
that established this shape.
"""

from __future__ import annotations

import time
from collections.abc import AsyncIterator, Iterator
from dataclasses import dataclass
from functools import lru_cache
from typing import Any, Literal

from google import genai
from google.genai import types

from duyo.core.config import get_settings

LiveEventKind = Literal[
    "audio",          # PCM chunk (24000Hz mono 16-bit) to forward to client
    "input_tr",       # incremental child-speech transcription chunk
    "output_tr",      # incremental DUYO-response text chunk
    "gen_complete",   # model finished generating this turn
    "turn_complete",  # turn fully closed — iterator stops after this
]


@dataclass(frozen=True)
class LiveEvent:
    """Single normalised event from a Gemini Live session."""

    kind: LiveEventKind
    audio_data: bytes = b""
    text: str = ""
    elapsed_ms: int = 0


@lru_cache
def _get_live_client() -> genai.Client:
    """Cached genai.Client. Lifted out so tests can monkeypatch it."""
    settings = get_settings()
    if not settings.google_api_key:
        raise RuntimeError("GOOGLE_API_KEY is not set")
    return genai.Client(api_key=settings.google_api_key)


def _parse_message(msg: Any, elapsed_ms: int) -> Iterator[LiveEvent]:
    """Translate one SDK message into zero or more LiveEvents.

    Pure function — no I/O, no time call. Caller passes `elapsed_ms` so
    timing stays consistent with the receive loop. One SDK message may
    carry both an audio chunk and a transcription word, so we yield.
    """
    data = getattr(msg, "data", None)
    if data is not None and len(data) > 0:
        yield LiveEvent(kind="audio", audio_data=data, elapsed_ms=elapsed_ms)

    sc = getattr(msg, "server_content", None)
    if sc is None:
        return

    in_tr = getattr(sc, "input_transcription", None)
    if in_tr is not None and getattr(in_tr, "text", None):
        yield LiveEvent(kind="input_tr", text=in_tr.text, elapsed_ms=elapsed_ms)

    out_tr = getattr(sc, "output_transcription", None)
    if out_tr is not None and getattr(out_tr, "text", None):
        yield LiveEvent(kind="output_tr", text=out_tr.text, elapsed_ms=elapsed_ms)

    if getattr(sc, "generation_complete", False):
        yield LiveEvent(kind="gen_complete", elapsed_ms=elapsed_ms)

    if getattr(sc, "turn_complete", False):
        yield LiveEvent(kind="turn_complete", elapsed_ms=elapsed_ms)


class GeminiVoiceSession:
    """A single Gemini Live voice turn.

    Usage::

        async with GeminiVoiceSession(system_prompt="...") as session:
            await session.start_activity()
            async for chunk in mic_chunks():
                await session.send_audio(chunk)
            await session.end_activity()
            async for event in session.events():
                if event.kind == "audio":
                    forward_to_client(event.audio_data)
                elif event.kind == "input_tr":
                    crisis_stream.feed(event.text)
    """

    def __init__(
        self,
        *,
        system_prompt: str,
        model: str | None = None,
    ) -> None:
        settings = get_settings()
        self._model = model or settings.gemini_model_live
        self._system_prompt = system_prompt
        self._input_rate = settings.gemini_live_input_sample_rate
        self._inner_cm: Any = None
        self._session: Any = None
        self._start: float = 0.0

    async def __aenter__(self) -> GeminiVoiceSession:
        client = _get_live_client()
        config = types.LiveConnectConfig(
            response_modalities=[types.Modality.AUDIO],
            system_instruction=types.Content(parts=[types.Part(text=self._system_prompt)]),
            output_audio_transcription=types.AudioTranscriptionConfig(),
            input_audio_transcription=types.AudioTranscriptionConfig(),
            realtime_input_config=types.RealtimeInputConfig(
                automatic_activity_detection=types.AutomaticActivityDetection(disabled=True),
            ),
        )
        self._inner_cm = client.aio.live.connect(model=self._model, config=config)
        self._session = await self._inner_cm.__aenter__()
        self._start = time.perf_counter()
        return self

    async def __aexit__(self, exc_type: Any, exc: Any, tb: Any) -> bool | None:
        if self._inner_cm is not None:
            return await self._inner_cm.__aexit__(exc_type, exc, tb)
        return None

    def _elapsed_ms(self) -> int:
        return int((time.perf_counter() - self._start) * 1000)

    async def start_activity(self) -> None:
        """Manual VAD: signal the start of one continuous user utterance."""
        await self._session.send_realtime_input(activity_start=types.ActivityStart())

    async def end_activity(self) -> None:
        """Manual VAD: signal the end of the utterance — model begins responding."""
        await self._session.send_realtime_input(activity_end=types.ActivityEnd())

    async def send_audio(self, pcm_chunk: bytes) -> None:
        """Push one PCM audio chunk (16000Hz mono 16-bit)."""
        await self._session.send_realtime_input(
            audio=types.Blob(
                data=pcm_chunk,
                mime_type=f"audio/pcm;rate={self._input_rate}",
            )
        )

    async def events(self) -> AsyncIterator[LiveEvent]:
        """Async iterator yielding normalised LiveEvents until turn_complete."""
        async for msg in self._session.receive():
            elapsed = self._elapsed_ms()
            for event in _parse_message(msg, elapsed):
                yield event
                if event.kind == "turn_complete":
                    return
