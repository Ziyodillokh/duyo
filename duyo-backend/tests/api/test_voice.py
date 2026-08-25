"""WebSocket tests for /v1/chat/voice.

Network-free: GeminiVoiceSession is replaced with a fake that replays a
canned event stream; the DB session is replaced with one that records
what would have been persisted. The real JWT path is exercised — a
genuine access token is minted for each test.
"""

from __future__ import annotations

import json
import uuid
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from typing import Any
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient

from duyo.api.deps import get_db
from duyo.api.v1.voice import get_voice_session_factory
from duyo.core.security import create_token
from duyo.main import app
from duyo.models.child import AgeSegment, ChildProfile, Language
from duyo.models.conversation import Conversation
from duyo.models.crisis_event import CrisisLevel
from duyo.models.message import Message, MessageRole
from duyo.models.user import User
from duyo.services.gemini_live import LiveEvent


@pytest.fixture(autouse=True)
def _mock_layer2(monkeypatch):
    """Stub crisis Layer 2 so voice tests never hit Gemini and stay deterministic.

    Returns the Layer 1 level with zero confidence — no escalation, no extra
    crisis event. Individual tests can override for escalation scenarios.
    """
    from duyo.api.v1 import voice as voice_module
    from duyo.services.crisis_l2 import Layer2Result

    async def _fake(_text, l1_level):
        return Layer2Result(level=l1_level, confidence=0.0, reasoning="", latency_ms=1)

    monkeypatch.setattr(voice_module, "classify", _fake)


# ---------------------------------------------------------------------------
# Fakes
# ---------------------------------------------------------------------------


@dataclass
class FakeAsyncSession:
    """Stand-in for AsyncSession — record adds, queue scalar() responses."""

    scalar_queue: list[Any] = field(default_factory=list)
    added: list[Any] = field(default_factory=list)
    flushed: bool = False
    committed: bool = False
    rolled_back: bool = False

    async def scalar(self, _stmt: Any) -> Any:
        if not self.scalar_queue:
            raise AssertionError("FakeAsyncSession.scalar called with no queued response")
        return self.scalar_queue.pop(0)

    def add(self, obj: Any) -> None:
        if hasattr(obj, "id") and getattr(obj, "id", None) is None:
            obj.id = uuid.uuid4()
        self.added.append(obj)

    async def flush(self) -> None:
        self.flushed = True
        for obj in self.added:
            if hasattr(obj, "id") and obj.id is None:
                obj.id = uuid.uuid4()

    async def commit(self) -> None:
        self.committed = True

    async def rollback(self) -> None:
        self.rolled_back = True

    async def close(self) -> None:
        pass


@dataclass
class FakeVoiceSession:
    """Stand-in for GeminiVoiceSession — records sends, replays events."""

    events_to_yield: list[LiveEvent] = field(default_factory=list)
    sent_audio: list[bytes] = field(default_factory=list)
    activity_started: bool = False
    activity_ended: bool = False
    system_prompt: str = ""

    async def __aenter__(self) -> FakeVoiceSession:
        return self

    async def __aexit__(self, *args: Any) -> None:
        return None

    async def start_activity(self) -> None:
        self.activity_started = True

    async def end_activity(self) -> None:
        self.activity_ended = True

    async def send_audio(self, pcm_chunk: bytes) -> None:
        self.sent_audio.append(pcm_chunk)

    async def events(self) -> AsyncIterator[LiveEvent]:
        for e in self.events_to_yield:
            yield e


def make_voice_session_factory(events: list[LiveEvent]) -> Any:
    """Returns a callable that mints a FakeVoiceSession per call."""

    created: list[FakeVoiceSession] = []

    def factory(
        *,
        system_prompt: str,
        model: str | None = None,
        voice: str | None = None,
    ) -> FakeVoiceSession:
        s = FakeVoiceSession(events_to_yield=list(events), system_prompt=system_prompt)
        s.voice = voice
        created.append(s)
        return s

    factory.created = created  # type: ignore[attr-defined]
    return factory


# ---------------------------------------------------------------------------
# Fixtures — user, child, token, app overrides
# ---------------------------------------------------------------------------


@pytest.fixture
def user() -> User:
    u = User(phone="+998901234567")
    u.id = uuid.uuid4()
    return u


@pytest.fixture
def child(user: User) -> ChildProfile:
    c = ChildProfile(
        parent_id=user.id,
        name="Aziza",
        age=9,
        age_segment=AgeSegment.JUNIOR,
        language=Language.UZ,
    )
    c.id = uuid.uuid4()
    return c


@pytest.fixture
def access_token(user: User) -> str:
    return create_token(str(user.id), token_type="access")


@pytest.fixture
def db_session() -> FakeAsyncSession:
    return FakeAsyncSession()


@pytest.fixture
def configured_app(db_session: FakeAsyncSession):
    """Yields an app instance with get_db overridden. Tests still set
    get_voice_session_factory per scenario."""

    async def override_get_db() -> AsyncIterator[FakeAsyncSession]:
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    yield app
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------


def test_voice_rejects_without_token(configured_app):
    client = TestClient(configured_app)
    with pytest.raises(Exception):
        with client.websocket_connect(f"/v1/chat/voice?child_id={uuid.uuid4()}"):
            pass


def test_voice_rejects_invalid_token(configured_app):
    client = TestClient(configured_app)
    with pytest.raises(Exception), client.websocket_connect(
        f"/v1/chat/voice?token=garbage&child_id={uuid.uuid4()}"
    ):
        pass


def test_voice_rejects_when_child_not_found(
    configured_app, db_session, access_token, user
):
    # User exists but child query returns None.
    db_session.scalar_queue = [user, None]
    factory = make_voice_session_factory([LiveEvent(kind="turn_complete")])
    app.dependency_overrides[get_voice_session_factory] = lambda: factory

    client = TestClient(configured_app)
    with pytest.raises(Exception), client.websocket_connect(
        f"/v1/chat/voice?token={access_token}&child_id={uuid.uuid4()}"
    ) as ws:
        ws.receive_json()


# ---------------------------------------------------------------------------
# Happy path — protocol + persistence
# ---------------------------------------------------------------------------


def _open(configured_app, access_token, child, query: str = "") -> None:
    """Open and immediately close a voice socket, letting the turn finish."""
    client = TestClient(configured_app)
    with client.websocket_connect(
        f"/v1/chat/voice?token={access_token}&child_id={child.id}{query}"
    ) as ws:
        # A chunk before END_TURN, the way the app sends one: the handler
        # is driven by the same sequence in every other test here.
        ws.send_bytes(b"USER_AUDIO")
        ws.send_text("END_TURN")
        while True:
            message = ws.receive()
            if message.get("text") and "turn_complete" in message["text"]:
                break


def test_a_chosen_voice_reaches_the_session(
    configured_app, db_session, access_token, user, child
):
    """The name the child picked is what the model is configured with."""
    db_session.scalar_queue = [user, child]
    factory = make_voice_session_factory([LiveEvent(kind="turn_complete", elapsed_ms=10)])
    app.dependency_overrides[get_voice_session_factory] = lambda: factory

    _open(configured_app, access_token, child, "&voice_name=Achernar")

    assert factory.created[0].voice == "Achernar"


def test_an_unknown_voice_falls_back_instead_of_refusing(
    configured_app, db_session, access_token, user, child
):
    """A stale client asking for a retired voice still gets a session.

    The name goes straight into the model config, so it has to be checked —
    but checking it must not become a socket that closes on connect for a
    child whose app is a version behind.
    """
    db_session.scalar_queue = [user, child]
    factory = make_voice_session_factory([LiveEvent(kind="turn_complete", elapsed_ms=10)])
    app.dependency_overrides[get_voice_session_factory] = lambda: factory

    _open(configured_app, access_token, child, "&voice_name=NotAVoice")

    assert factory.created[0].voice is None


def test_the_language_becomes_a_line_in_the_system_prompt(
    configured_app, db_session, access_token, user, child
):
    """Native-audio Live models reject an explicit language_code, so the
    instruction has to travel in the prompt or not at all."""
    db_session.scalar_queue = [user, child]
    factory = make_voice_session_factory([LiveEvent(kind="turn_complete", elapsed_ms=10)])
    app.dependency_overrides[get_voice_session_factory] = lambda: factory

    _open(configured_app, access_token, child, "&lang=ru")

    assert "rus tilida" in factory.created[0].system_prompt


def test_an_unknown_language_adds_nothing(
    configured_app, db_session, access_token, user, child
):
    db_session.scalar_queue = [user, child]
    factory = make_voice_session_factory([LiveEvent(kind="turn_complete", elapsed_ms=10)])
    app.dependency_overrides[get_voice_session_factory] = lambda: factory

    _open(configured_app, access_token, child, "&lang=klingon")

    prompt = factory.created[0].system_prompt
    assert "tilida gapir" not in prompt


def test_voice_happy_path_sends_ready_then_audio_then_turn_complete(
    configured_app, db_session, access_token, user, child
):
    db_session.scalar_queue = [user, child]
    events = [
        LiveEvent(kind="input_tr", text="Salom DUYO", elapsed_ms=100),
        LiveEvent(kind="audio", audio_data=b"PCM1", elapsed_ms=500),
        LiveEvent(kind="output_tr", text=" Salom", elapsed_ms=520),
        LiveEvent(kind="audio", audio_data=b"PCM2", elapsed_ms=600),
        LiveEvent(kind="turn_complete", elapsed_ms=1000),
    ]
    factory = make_voice_session_factory(events)
    app.dependency_overrides[get_voice_session_factory] = lambda: factory

    client = TestClient(configured_app)
    received_audio: list[bytes] = []
    received_text: list[dict] = []
    with client.websocket_connect(
        f"/v1/chat/voice?token={access_token}&child_id={child.id}"
    ) as ws:
        ws.send_bytes(b"USER_AUDIO_1")
        ws.send_bytes(b"USER_AUDIO_2")
        ws.send_text("END_TURN")
        while True:
            msg = ws.receive()
            if msg.get("bytes"):
                received_audio.append(msg["bytes"])
            elif msg.get("text"):
                payload = json.loads(msg["text"])
                received_text.append(payload)
                if payload["type"] == "turn_complete":
                    break
            elif msg.get("type") == "websocket.disconnect":
                break

    # Forwarded audio chunks to Gemini, both directions covered.
    fake = factory.created[0]  # type: ignore[attr-defined]
    assert fake.sent_audio == [b"USER_AUDIO_1", b"USER_AUDIO_2"]
    assert fake.activity_started and fake.activity_ended
    assert received_audio == [b"PCM1", b"PCM2"]

    types_sent = [m["type"] for m in received_text]
    assert "ready" in types_sent
    assert "input_transcript" in types_sent
    assert "output_transcript" in types_sent
    assert "turn_complete" in types_sent

    # Persistence: new Conversation + child Message + assistant Message added.
    convs = [o for o in db_session.added if isinstance(o, Conversation)]
    msgs = [o for o in db_session.added if isinstance(o, Message)]
    assert len(convs) == 1
    assert convs[0].child_id == child.id
    assert {m.role for m in msgs} == {MessageRole.CHILD, MessageRole.ASSISTANT}

    child_msg = next(m for m in msgs if m.role == MessageRole.CHILD)
    assistant_msg = next(m for m in msgs if m.role == MessageRole.ASSISTANT)
    assert child_msg.content == "Salom DUYO"
    assert assistant_msg.content == " Salom"
    assert db_session.committed


# ---------------------------------------------------------------------------
# Crisis path — RED detected mid-stream, parent SMS dispatched
# ---------------------------------------------------------------------------


def test_voice_red_crisis_emits_event_and_dispatches_sms(
    configured_app,
    db_session,
    access_token,
    user,
    child,
    monkeypatch,
):
    db_session.scalar_queue = [user, child]
    events = [
        LiveEvent(kind="input_tr", text="men o'zimni o'ldiraman"),
        LiveEvent(kind="turn_complete"),
    ]
    factory = make_voice_session_factory(events)
    app.dependency_overrides[get_voice_session_factory] = lambda: factory

    sms_send = AsyncMock()
    from duyo.services import sms as sms_module

    class _FakeSmsProvider:
        send = sms_send

    monkeypatch.setattr(sms_module, "get_sms_provider", lambda: _FakeSmsProvider())

    client = TestClient(configured_app)
    crisis_payloads: list[dict] = []
    with client.websocket_connect(
        f"/v1/chat/voice?token={access_token}&child_id={child.id}"
    ) as ws:
        ws.send_text("END_TURN")
        while True:
            msg = ws.receive()
            if msg.get("text"):
                payload = json.loads(msg["text"])
                if payload["type"] == "crisis":
                    crisis_payloads.append(payload)
                if payload["type"] == "turn_complete":
                    break

    # Client got a RED crisis event.
    assert crisis_payloads
    assert crisis_payloads[0]["level"] == "RED"

    # CrisisEvent row added in DB.
    from duyo.models.crisis_event import CrisisEvent
    crisis_rows = [o for o in db_session.added if isinstance(o, CrisisEvent)]
    assert len(crisis_rows) == 1
    assert crisis_rows[0].level == CrisisLevel.RED

    # Parent SMS dispatched once.
    assert sms_send.await_count == 1
    sent_phone = sms_send.call_args.args[0]
    assert sent_phone == user.phone


# ---------------------------------------------------------------------------
# Personal memory — a child who SAYS something memorable gets the same
# "eslab qolaymi?" offer as one who types it.
#
# The candidate rides back in turn_complete and is never persisted: the
# device screens it and asks the child (see services/memory_candidates.py and
# duyo-mobile/src/hooks/use-memory-consent.ts).
# ---------------------------------------------------------------------------


def _run_voice_turn(configured_app, access_token, child, events):
    """Drive one voice turn to completion; return the turn_complete payload."""
    factory = make_voice_session_factory(events)
    app.dependency_overrides[get_voice_session_factory] = lambda: factory

    client = TestClient(configured_app)
    with client.websocket_connect(
        f"/v1/chat/voice?token={access_token}&child_id={child.id}"
    ) as ws:
        ws.send_text("END_TURN")
        while True:
            msg = ws.receive()
            if msg.get("text"):
                payload = json.loads(msg["text"])
                if payload["type"] == "turn_complete":
                    return payload
            elif msg.get("type") == "websocket.disconnect":
                raise AssertionError("socket closed before turn_complete")


def test_voice_turn_complete_carries_a_memory_candidate(
    configured_app, db_session, access_token, user, child, monkeypatch
):
    db_session.scalar_queue = [user, child]

    from duyo.api.v1 import voice as voice_api
    from duyo.services.memory_candidates import MemoryCandidate

    seen: list[str] = []

    async def _fake_extract(message: str):
        seen.append(message)
        return MemoryCandidate(
            category="interests", content="Bola shaxmatga qiziqadi"
        )

    monkeypatch.setattr(voice_api, "extract_memory_candidate", _fake_extract)

    payload = _run_voice_turn(
        configured_app, access_token, child,
        [
            LiveEvent(kind="input_tr", text="Men shaxmat o'ynashni yaxshi ko'raman"),
            LiveEvent(kind="turn_complete"),
        ],
    )

    assert payload["memory_candidate"] == {
        "category": "interests",
        "content": "Bola shaxmatga qiziqadi",
    }
    # Extraction runs on what the child SAID, i.e. the STT transcript.
    assert seen == ["Men shaxmat o'ynashni yaxshi ko'raman"]


def test_voice_memory_candidate_absent_when_nothing_worth_remembering(
    configured_app, db_session, access_token, user, child, monkeypatch
):
    """Most turns carry nothing — the key must be absent, not null."""
    db_session.scalar_queue = [user, child]

    from duyo.api.v1 import voice as voice_api

    async def _no_candidate(_message: str):
        return None

    monkeypatch.setattr(voice_api, "extract_memory_candidate", _no_candidate)

    payload = _run_voice_turn(
        configured_app, access_token, child,
        [
            LiveEvent(kind="input_tr", text="Bugun havo qanday"),
            LiveEvent(kind="turn_complete"),
        ],
    )
    assert "memory_candidate" not in payload


def test_voice_never_offers_to_remember_a_crisis_turn(
    configured_app, db_session, access_token, user, child, monkeypatch
):
    """A child in crisis is being routed to help, not asked to save a note.

    The extractor may still have been started (the level is not known until
    Layer 2 returns), but its result must never reach the client.
    """
    db_session.scalar_queue = [user, child]

    from duyo.api.v1 import voice as voice_api
    from duyo.services import sms as sms_module
    from duyo.services.memory_candidates import MemoryCandidate

    async def _would_extract(_message: str):
        return MemoryCandidate(category="notes", content="eslab qolinmasin")

    monkeypatch.setattr(voice_api, "extract_memory_candidate", _would_extract)

    class _FakeSmsProvider:
        send = AsyncMock()

    monkeypatch.setattr(sms_module, "get_sms_provider", lambda: _FakeSmsProvider())

    payload = _run_voice_turn(
        configured_app, access_token, child,
        [
            LiveEvent(kind="input_tr", text="men o'zimni o'ldiraman"),
            LiveEvent(kind="turn_complete"),
        ],
    )
    assert "memory_candidate" not in payload


def test_voice_memory_candidate_is_never_persisted(
    configured_app, db_session, access_token, user, child, monkeypatch
):
    """Same guarantee as the text path: no row, anywhere, for the candidate."""
    db_session.scalar_queue = [user, child]

    from duyo.api.v1 import voice as voice_api
    from duyo.services.memory_candidates import MemoryCandidate

    async def _fake_extract(_message: str):
        return MemoryCandidate(category="research", content="UNIQUE_MEMORY_MARKER")

    monkeypatch.setattr(voice_api, "extract_memory_candidate", _fake_extract)

    payload = _run_voice_turn(
        configured_app, access_token, child,
        [
            LiveEvent(kind="input_tr", text="Men ilmiy ish qilyapman"),
            LiveEvent(kind="turn_complete"),
        ],
    )
    assert payload["memory_candidate"]["content"] == "UNIQUE_MEMORY_MARKER"

    # The marker must appear in NOTHING that was handed to the database.
    for obj in db_session.added:
        for value in vars(obj).values():
            assert "UNIQUE_MEMORY_MARKER" not in str(value)


def test_voice_extraction_failure_does_not_break_the_turn(
    configured_app, db_session, access_token, user, child, monkeypatch
):
    """A missed memory prompt must never cost the child the end of their turn."""
    db_session.scalar_queue = [user, child]

    from duyo.api.v1 import voice as voice_api

    async def _boom(_message: str):
        raise RuntimeError("extractor exploded")

    monkeypatch.setattr(voice_api, "extract_memory_candidate", _boom)

    payload = _run_voice_turn(
        configured_app, access_token, child,
        [
            LiveEvent(kind="input_tr", text="Men shaxmatni yaxshi ko'raman"),
            LiveEvent(kind="turn_complete"),
        ],
    )
    assert payload["type"] == "turn_complete"
    assert "memory_candidate" not in payload


# ---------------------------------------------------------------------------
# Brain-map feed: what the child says out loud reaches the insight extractor
# ---------------------------------------------------------------------------


def _drive_one_turn(configured_app, access_token, child, events):
    factory = make_voice_session_factory(events)
    app.dependency_overrides[get_voice_session_factory] = lambda: factory
    client = TestClient(configured_app)
    with client.websocket_connect(
        f"/v1/chat/voice?token={access_token}&child_id={child.id}"
    ) as ws:
        ws.send_bytes(b"AUDIO")
        ws.send_text("END_TURN")
        while True:
            msg = ws.receive()
            if msg.get("text"):
                payload = json.loads(msg["text"])
                if payload["type"] in ("turn_complete", "error"):
                    break
            elif msg.get("type") == "websocket.disconnect":
                break


def test_voice_green_turn_feeds_the_insight_extractor(
    configured_app, db_session, access_token, user, child, monkeypatch
):
    """A spoken sentence must reach the brain map exactly like a typed one —
    voice used to skip the extractor entirely, so nothing a child SAID ever
    produced a topic note or a goal."""
    from duyo.api.v1 import voice as voice_module

    calls: list[tuple] = []

    async def _noop():
        return None

    def _fake_extract(child_id, message, history=None):
        # Recorded synchronously (when create_task's argument is built), so
        # the assertion does not race the fire-and-forget task itself.
        calls.append((child_id, message, list(history or [])))
        return _noop()

    monkeypatch.setattr(voice_module, "extract_child_insights", _fake_extract)

    db_session.scalar_queue = [user, child]
    _drive_one_turn(configured_app, access_token, child, [
        LiveEvent(kind="input_tr", text="Dinozavrlar haqida bilmoqchiman", elapsed_ms=100),
        LiveEvent(kind="output_tr", text="Ajoyib mavzu!", elapsed_ms=300),
        LiveEvent(kind="turn_complete", elapsed_ms=500),
    ])

    assert len(calls) == 1
    child_id, message, _history = calls[0]
    assert child_id == child.id
    assert message == "Dinozavrlar haqida bilmoqchiman"


def test_voice_crisis_turn_is_not_mined_for_insights(
    configured_app, db_session, access_token, user, child, monkeypatch
):
    """A crisis turn belongs to the crisis machinery — same GREEN-only gate
    as the text path."""
    from duyo.api.v1 import voice as voice_module

    calls: list[tuple] = []

    async def _noop():
        return None

    def _fake_extract(*args, **kwargs):
        calls.append(args)
        return _noop()

    monkeypatch.setattr(voice_module, "extract_child_insights", _fake_extract)

    class _FakeSmsProvider:
        async def send(self, _phone, _message):
            return True

    monkeypatch.setattr(
        voice_module.sms_module, "get_sms_provider", lambda: _FakeSmsProvider()
    )

    db_session.scalar_queue = [user, child]
    _drive_one_turn(configured_app, access_token, child, [
        LiveEvent(kind="input_tr", text="men o'zimni o'ldiraman", elapsed_ms=100),
        LiveEvent(kind="turn_complete", elapsed_ms=500),
    ])

    assert calls == []
