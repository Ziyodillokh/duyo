"""DELETE /v1/me — the erasure Google Play has required since 31 May 2024.

Run against a real async session on SQLite with foreign keys enforced, as in
tests/api/test_group_safety.py, because the thing worth proving is exactly the
thing a fake session cannot: that the cascade reaches the rows nobody names,
and that the two carve-outs survive it.
"""

from __future__ import annotations

import asyncio
import itertools
from uuid import uuid4

import pytest
from sqlalchemy import event, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles

from duyo.api.v1 import me as me_module
from duyo.models.base import Base
from duyo.models.child import AgeSegment, ChildProfile, Language
from duyo.models.conversation import Conversation
from duyo.models.crisis_event import CrisisEvent, CrisisLevel
from duyo.models.message import Message, MessageRole
from duyo.models.social import ChildSocialSettings, GroupMessage
from duyo.models.user import User
from duyo.services import account_deletion


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


@compiles(JSONB, "sqlite")
def _jsonb_on_sqlite(_type, _compiler, **_kw) -> str:
    """Most models declare JSON().with_variant(JSONB) for exactly this; a few
    (reports, audit_logs) name JSONB outright and SQLite cannot render it.
    The cascade graph is the point here, not the column type."""
    return "JSON"


# `seq` is a Postgres IDENTITY column SQLite has no notion of — same shim as
# tests/api/test_group_notes.py.
_seq = itertools.count(5000)


@event.listens_for(GroupMessage, "before_insert", propagate=True)
def _fill_seq(_mapper, _conn, target: GroupMessage) -> None:
    if target.seq is None:
        target.seq = next(_seq)


def _family_tables() -> list:
    """Every table connected to `users` by a foreign key, transitively.

    Derived rather than listed. SQLite refuses a delete whose referencing
    table is merely absent, so the fixture needs the whole cascade graph — and
    a hand-written list is a list that silently stops being complete the day
    someone adds a table, which is the exact failure this test exists to
    catch. Both directions, because SQLite wants the parent tables present
    too (child_goals points at goal_catalog).
    """
    tables = Base.metadata.tables
    reached = {"users"}
    while True:
        grown = set(reached)
        for name, table in tables.items():
            targets = {fk.column.table.name for fk in table.foreign_keys}
            if name in reached:
                grown |= targets
            if targets & reached:
                grown.add(name)
        if grown == reached:
            return [tables[name] for name in reached]
        reached = grown


@pytest.fixture
def session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")

    @event.listens_for(engine.sync_engine, "connect")
    def _fk_on(dbapi_conn, _record):
        # Off by default in SQLite, and without it ON DELETE CASCADE is a
        # comment — the test would pass while proving nothing.
        dbapi_conn.execute("PRAGMA foreign_keys=ON")

    tables = _family_tables()

    async def build():
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all, tables=tables)
        return async_sessionmaker(engine, expire_on_commit=False)()

    s = _run(build())
    yield s
    _run(s.close())


@pytest.fixture(autouse=True)
def _no_side_effects(monkeypatch):
    """Redis and MinIO are not part of what these assert."""
    removed: list[str] = []

    async def _purged(_phone):
        return None

    monkeypatch.setattr(account_deletion.otp, "purge", _purged)
    monkeypatch.setattr(account_deletion.storage, "remove", removed.append)
    return removed


def _family(session, *, phone="+998901234567") -> tuple[User, ChildProfile]:
    user = User(id=uuid4(), phone=phone)
    child = ChildProfile(
        id=uuid4(),
        parent_id=user.id,
        name="Aziza",
        age=14,
        age_segment=AgeSegment.from_age(14),
        language=Language.UZ,
        interests=[],
    )
    session.add_all([user, child])
    _run(session.flush())
    return user, child


def test_deleting_the_account_takes_the_children_and_their_messages(session):
    user, child = _family(session)
    conv = Conversation(id=uuid4(), child_id=child.id)
    session.add(conv)
    session.add(Message(id=uuid4(), conversation_id=conv.id, role=MessageRole.CHILD, content="salom"))
    session.add(ChildSocialSettings(id=uuid4(), child_id=child.id, display_name="Bek-17"))
    _run(session.commit())

    receipt = _run(account_deletion.delete_account(session, user))

    assert receipt.children == 1
    assert _run(session.scalar(select(User).where(User.id == user.id))) is None
    assert _run(session.scalar(select(ChildProfile))) is None
    assert _run(session.scalar(select(Conversation))) is None
    assert _run(session.scalar(select(Message))) is None
    assert _run(session.scalar(select(ChildSocialSettings))) is None


def test_the_safety_record_survives_the_family_that_produced_it(session):
    """Seven-year retention, de-identified. See models/crisis_event.py."""
    user, child = _family(session)
    session.add(
        CrisisEvent(
            id=uuid4(),
            child_id=child.id,
            level=CrisisLevel.RED,
            layer=1,
            matches=[{"keyword": "x", "category": "self_harm", "language": "uz"}],
        )
    )
    _run(session.commit())

    receipt = _run(account_deletion.delete_account(session, user))

    assert receipt.crisis_events_retained == 1
    event_row = _run(session.scalar(select(CrisisEvent)))
    assert event_row is not None
    assert event_row.child_id is None
    assert event_row.level is CrisisLevel.RED


def test_a_group_note_keeps_its_transcript_and_loses_its_recording(session):
    """The room's record stays; a deleted child's voice does not."""
    user, child = _family(session)
    session.add(
        GroupMessage(
            id=uuid4(),
            group_key="kitoblar:companion",
            sender_child_id=child.id,
            sender_name="Bek-17",
            body="salom",
            media_key="deadbeef.webm",
            media_kind="audio",
            media_duration_ms=1200,
        )
    )
    _run(session.commit())

    _run(account_deletion.delete_account(session, user))

    note = _run(session.scalar(select(GroupMessage)))
    assert note is not None
    assert note.body == "salom"
    assert note.media_key is None
    assert note.media_kind is None
    assert note.media_duration_ms is None


def test_the_recording_itself_leaves_the_bucket(session, _no_side_effects):
    user, child = _family(session)
    child.photo_key = "photo.jpg"
    session.add(
        GroupMessage(
            id=uuid4(),
            group_key="kitoblar:companion",
            sender_child_id=child.id,
            sender_name="Bek-17",
            body="salom",
            media_key="note.webm",
            media_kind="audio",
        )
    )
    _run(session.commit())

    receipt = _run(account_deletion.delete_account(session, user))

    assert receipt.media_objects == 2
    assert set(_no_side_effects) == {"photo.jpg", "note.webm"}


def test_an_unreachable_bucket_does_not_undo_the_erasure(session, monkeypatch):
    """The rows are already gone; an orphan file is a cleanup job."""
    user, child = _family(session)
    child.photo_key = "photo.jpg"
    _run(session.commit())

    def _boom(_key):
        raise RuntimeError("minio down")

    monkeypatch.setattr(account_deletion.storage, "remove", _boom)

    _run(account_deletion.delete_account(session, user))
    assert _run(session.scalar(select(User).where(User.id == user.id))) is None


def test_a_childs_own_login_goes_with_the_family(session):
    """A linked account holds a second phone number and nothing else."""
    user, child = _family(session)
    child_account = User(id=uuid4(), phone="+998901112233")
    session.add(child_account)
    _run(session.flush())
    child.child_user_id = child_account.id
    _run(session.commit())

    _run(account_deletion.delete_account(session, user))

    assert _run(session.scalar(select(User))) is None


def test_another_familys_data_is_untouched(session):
    user, _child = _family(session)
    other_user, other_child = _family(session, phone="+998907654321")
    _run(session.commit())

    _run(account_deletion.delete_account(session, user))

    survivors = list(_run(session.scalars(select(ChildProfile))).all())
    assert [c.id for c in survivors] == [other_child.id]
    assert _run(session.scalar(select(User).where(User.id == other_user.id))) is not None


def test_the_route_answers_nothing_and_erases(session):
    user, _child = _family(session)
    _run(session.commit())

    assert _run(me_module.delete_me(current_user=user, db=session)) is None
    assert _run(session.scalar(select(User))) is None
