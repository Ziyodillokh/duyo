"""Voice/video notes in a goal group — the safety contract, asserted.

A note is the one way media enters a room full of children, so the thing worth
testing is not that a file lands in a bucket. It is that:

* nothing is delivered that no screen has read (transcription failing must
  REFUSE, never pass through);
* a transcript that trips `screen_peer_message` is blocked exactly as the same
  words typed would be, and the row survives as the safety record;
* the clip is never stored before those checks decide.

Route functions are called directly with a real async session rather than over
HTTP — the same approach as tests/api/test_note_api.py, and it keeps the auth
plumbing out of a test that is about moderation.

SQLite rather than Postgres so the suite needs no container; same caveat as
the neighbouring tests.
"""

from __future__ import annotations

import asyncio
import itertools
from datetime import UTC, datetime
from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy import event, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from duyo.api.v1 import social as mod
from duyo.crisis.detector import KeywordCrisisDetector
from duyo.models.base import Base
from duyo.models.child import AgeSegment, ChildProfile, Language
from duyo.models.goal import ChildGoal, GoalCatalog, GoalKind, GoalSource, GoalStatus
from duyo.models.social import (
    ChildSocialSettings,
    GroupMessage,
    PeerModerationState,
)
from duyo.models.user import User
from duyo.services.groups import category_of, group_key
from duyo.services.media_notes import Transcription


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


# `GroupMessage.seq` is a Postgres IDENTITY column, which SQLite has no notion
# of: the insert arrives with seq=NULL and trips a NOT NULL constraint before
# any assertion runs. Filling it here is what lets these tests use the same
# containerless SQLite engine as the rest of tests/api.
_seq = itertools.count(1)


@event.listens_for(GroupMessage, "before_insert", propagate=True)
def _fill_seq(_mapper, _conn, target: GroupMessage) -> None:
    if target.seq is None:
        target.seq = next(_seq)


_TABLES = (
    "users",
    "child_profiles",
    "goal_catalog",
    "child_goals",
    "child_social_settings",
    "group_messages",
)


@pytest.fixture
def session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    tables = [Base.metadata.tables[name] for name in _TABLES]

    async def build():
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all, tables=tables)
        factory = async_sessionmaker(engine, expire_on_commit=False)
        return factory()

    s = _run(build())
    yield s
    _run(s.close())
    _run(engine.dispose())


class _FakeUpload:
    """The two bits of UploadFile the route touches."""

    def __init__(self, data: bytes, content_type: str):
        self._data = data
        self.content_type = content_type

    async def read(self) -> bytes:
        return self._data


async def _member(session, *, key="book_kichkina_shahzoda"):
    """A 14-year-old in the room their goal and age actually put them in.

    The group key is DERIVED rather than written out: a 14-year-old is a
    "companion", not an "explorer", and hard-coding the wrong segment made
    every one of these tests fail on the membership gate instead of on the
    thing they were written to check.
    """
    session.add(
        GoalCatalog(
            match_key=key,
            kind=GoalKind.OTHER,
            title="Kichkina shahzoda",
            age_min=7,
            age_max=16,
            active=True,
            matchable=True,
        )
    )
    user = User(phone=f"+9989{uuid4().int % 10**8:08d}")
    session.add(user)
    await session.flush()
    child = ChildProfile(
        parent_id=user.id,
        name="Aziza",
        age=14,
        age_segment=AgeSegment.from_age(14),
        language=Language.UZ,
        interests=[],
    )
    session.add(child)
    await session.flush()
    session.add(
        ChildSocialSettings(
            child_id=child.id, display_name="Aziza-42", discoverable=True
        )
    )
    session.add(
        ChildGoal(
            child_id=child.id,
            kind=GoalKind.OTHER,
            title="Kichkina shahzoda",
            match_key=key,
            status=GoalStatus.ACTIVE,
            source=GoalSource.CHILD_STATED,
            confirmed_at=datetime.now(UTC),
        )
    )
    await session.flush()
    category = category_of(key)
    assert category is not None, "test goal must belong to a category"
    return user, child, group_key(category.key, child.age_segment)


def _patch(monkeypatch, *, transcript: str | None, uploaded: list[str]):
    """Stub the two outside services: the LLM and the bucket.

    `transcript=None` means transcription FAILED, which is the case the fail-
    closed rule exists for.
    """

    async def fake_transcribe(data: bytes, content_type: str) -> Transcription:
        if transcript is None:
            return Transcription(text="", ok=False, error="boom", latency_ms=1)
        return Transcription(text=transcript, ok=True, error=None, latency_ms=1)

    def fake_upload(data: bytes, content_type: str) -> str:
        uploaded.append(content_type)
        return "deadbeef.webm"

    monkeypatch.setattr(mod, "transcribe", fake_transcribe)
    monkeypatch.setattr(mod.storage, "upload", fake_upload)
    # Default to a configured backend; the two tests about a MISSING key call
    # _no_key afterwards to override this.
    _with_key(monkeypatch)


def _no_key(monkeypatch, *, env: str):
    """A backend with no Gemini key, in the given environment."""

    class _Fake:
        google_api_key = ""
        app_env = env
        public_base_url = "http://localhost:8010"

    monkeypatch.setattr(mod, "get_app_settings", lambda: _Fake())


def _with_key(monkeypatch):
    """The normal case: a key is configured, so transcription runs."""

    class _Fake:
        google_api_key = "test-key"
        app_env = "development"
        public_base_url = "http://localhost:8010"

    monkeypatch.setattr(mod, "get_app_settings", lambda: _Fake())


async def _send(session, user, child, key, *, kind="audio", ctype="audio/webm"):
    return await mod.send_group_note(
        child_id=child.id,
        key=key,
        file=_FakeUpload(b"\x1a\x45\xdf\xa3fake-clip", ctype),
        kind=kind,
        duration_ms=4200,
        current_user=user,
        db=session,
        detector=KeywordCrisisDetector(),
    )


# --- the happy path ---------------------------------------------------------


def test_clean_note_is_delivered_with_its_transcript(session, monkeypatch):
    uploaded: list[str] = []
    _patch(monkeypatch, transcript="Salom, bugun kitobni tugatdim", uploaded=uploaded)

    async def scenario():
        user, child, key = await _member(session)
        out = await _send(session, user, child, key)

        assert out.media_kind == "audio"
        assert out.media_duration_ms == 4200
        # The transcript IS the body — that is what the screen judged and what
        # a child who cannot play the clip reads.
        assert out.body == "Salom, bugun kitobni tugatdim"
        # And the URL is the authenticated route, never the public media one.
        assert "/v1/social/" in (out.media_url or "")
        assert "/content/media/" not in (out.media_url or "")
        assert uploaded == ["audio/webm"]

    _run(scenario())


def test_a_wordless_clip_still_gets_a_caption(session, monkeypatch):
    _patch(monkeypatch, transcript="", uploaded=[])

    async def scenario():
        user, child, key = await _member(session)
        out = await _send(session, user, child, key, kind="video", ctype="video/webm")
        # An empty body would render as an empty bubble.
        assert out.body == "Video xabar"

    _run(scenario())


# --- the safety rules -------------------------------------------------------


def test_untranscribable_clip_is_refused_and_never_stored(session, monkeypatch):
    """The whole point: nothing reaches the room that nothing has read."""
    uploaded: list[str] = []
    _patch(monkeypatch, transcript=None, uploaded=uploaded)

    async def scenario():
        user, child, key = await _member(session)
        with pytest.raises(HTTPException) as exc:
            await _send(session, user, child, key)
        assert exc.value.status_code == 503

        # Nothing uploaded and nothing recorded — a clip nobody read must not
        # linger in the bucket either.
        assert uploaded == []
        rows = (await session.execute(select(GroupMessage))).scalars().all()
        assert rows == []

    _run(scenario())


def test_transcript_that_trips_the_screen_is_blocked_and_kept(session, monkeypatch):
    """Spoken contact details are contact details."""
    uploaded: list[str] = []
    _patch(
        monkeypatch,
        transcript="Menga telegramda yoz: +998901234567",
        uploaded=uploaded,
    )

    async def scenario():
        user, child, key = await _member(session)
        with pytest.raises(HTTPException) as exc:
            await _send(session, user, child, key)
        assert exc.value.status_code == 422

        rows = (await session.execute(select(GroupMessage))).scalars().all()
        assert len(rows) == 1
        # The blocked row IS the safety record, and it keeps the clip so a
        # moderator can hear what the transcript only approximates.
        assert rows[0].moderation_state == PeerModerationState.BLOCKED
        assert rows[0].media_key == "deadbeef.webm"
        assert rows[0].moderation_reason

    _run(scenario())


def test_dev_without_a_key_delivers_but_marks_the_row_unscreened(
    session, monkeypatch
):
    """A local backend has no GOOGLE_API_KEY, so notes could never be sent
    while developing. They go through — and the row says a screen never ran."""
    uploaded: list[str] = []
    _patch(monkeypatch, transcript=None, uploaded=uploaded)
    _no_key(monkeypatch, env="development")

    async def scenario():
        user, child, key = await _member(session)
        out = await _send(session, user, child, key)
        assert out.body == "Ovozli xabar"

        rows = (await session.execute(select(GroupMessage))).scalars().all()
        assert len(rows) == 1
        assert rows[0].moderation_state == PeerModerationState.DELIVERED
        # The row never claims a screen that did not happen.
        assert rows[0].moderation_reason == "dev_unscreened"

    _run(scenario())


def test_production_without_a_key_still_refuses(session, monkeypatch):
    """Misconfigured must never quietly become unmoderated where real children
    are. This is the guard that keeps the development path from mattering."""
    uploaded: list[str] = []
    _patch(monkeypatch, transcript=None, uploaded=uploaded)
    _no_key(monkeypatch, env="production")

    async def scenario():
        user, child, key = await _member(session)
        with pytest.raises(HTTPException) as exc:
            await _send(session, user, child, key)
        assert exc.value.status_code == 503
        assert uploaded == []
        assert (await session.execute(select(GroupMessage))).scalars().all() == []

    _run(scenario())


def test_non_member_cannot_post_a_note(session, monkeypatch):
    _patch(monkeypatch, transcript="salom", uploaded=[])

    async def scenario():
        user, child, _key = await _member(session)
        with pytest.raises(HTTPException) as exc:
            # Same age band, a category this child holds no goal in.
            await _send(
                session, user, child, group_key("sport", child.age_segment)
            )
        assert exc.value.status_code == 403

    _run(scenario())


def test_mismatched_content_type_is_rejected(session, monkeypatch):
    """kind=video with an audio file, or anything not on the allowlist."""
    uploaded: list[str] = []
    _patch(monkeypatch, transcript="salom", uploaded=uploaded)

    async def scenario():
        user, child, key = await _member(session)
        with pytest.raises(HTTPException) as exc:
            await _send(session, user, child, key, kind="video", ctype="audio/webm")
        assert exc.value.status_code == 400
        assert uploaded == []

    _run(scenario())


def test_codec_parameters_do_not_defeat_the_allowlist(session, monkeypatch):
    """A browser sends "audio/webm;codecs=opus", never a bare type."""
    uploaded: list[str] = []
    _patch(monkeypatch, transcript="salom", uploaded=uploaded)

    async def scenario():
        user, child, key = await _member(session)
        out = await _send(
            session, user, child, key, ctype="audio/webm;codecs=opus"
        )
        assert out.media_kind == "audio"
        assert uploaded == ["audio/webm"]

    _run(scenario())


def test_overlong_note_is_rejected_before_anything_else(session, monkeypatch):
    uploaded: list[str] = []
    _patch(monkeypatch, transcript="salom", uploaded=uploaded)

    async def scenario():
        user, child, key = await _member(session)
        with pytest.raises(HTTPException) as exc:
            await mod.send_group_note(
                child_id=child.id,
                key=key,
                file=_FakeUpload(b"x", "audio/webm"),
                kind="audio",
                duration_ms=10 * 60 * 1000,
                current_user=user,
                db=session,
                detector=KeywordCrisisDetector(),
            )
        assert exc.value.status_code == 400
        assert uploaded == []

    _run(scenario())
