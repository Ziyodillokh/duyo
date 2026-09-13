"""The voice ceiling against a real query, not a fake session.

test_limits.py checks the decision — what the tier says and where the boundary
falls — with a session that hands back numbers. Nothing there executes SQL, so
a WHERE clause that counted the wrong rows would pass every one of those tests
and hand a free account unlimited voice, or bill a typed message against the
spoken quota.

These run `_voice_turns_today` against a real database with real rows.
"""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from duyo.billing import limits
from duyo.models.base import Base
from duyo.models.child import AgeSegment, ChildProfile, Language
from duyo.models.conversation import Conversation
from duyo.models.crisis_event import CrisisLevel
from duyo.models.message import MODALITY_VOICE, Message, MessageRole

NOW = datetime(2026, 6, 1, 12, 0, tzinfo=UTC)
DAY_START = NOW.replace(hour=0, minute=0, second=0, microsecond=0)

_TABLES = ("child_profiles", "conversations", "messages")


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


@pytest.fixture
def db():
    """A throwaway database holding only the three tables the query touches."""

    async def _build():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        tables = [Base.metadata.tables[n] for n in _TABLES]
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all, tables=tables)
        return engine, async_sessionmaker(engine, expire_on_commit=False)()

    engine, session = _run(_build())
    yield session
    _run(session.close())
    _run(engine.dispose())


def _seed(session, parent_id):
    """One parent, one child, one conversation to hang messages off.

    Flushed between the two: the primary key is assigned on flush, so building
    the Conversation first would hand it child_id=None.
    """
    child = ChildProfile(
        parent_id=parent_id, name="Bek", age=14,
        age_segment=AgeSegment.COMPANION, language=Language.UZ,
    )
    session.add(child)
    _run(session.flush())
    conv = Conversation(child_id=child.id)
    session.add(conv)
    _run(session.flush())
    return conv


def _msg(session, conv, *, role, modality, at):
    m = Message(
        conversation_id=conv.id, role=role, content="x",
        crisis_level=CrisisLevel.GREEN, modality=modality,
    )
    m.created_at = at
    session.add(m)
    return m


def _count(session, parent_id):
    return _run(limits._voice_turns_today(session, parent_id, NOW))


def test_a_spoken_turn_counts_once_not_twice(db):
    """A turn writes a child row and an assistant row; it must cost one."""
    parent = uuid4()
    conv = _seed(db, parent)
    _msg(db, conv, role=MessageRole.CHILD, modality=MODALITY_VOICE, at=NOW)
    _msg(db, conv, role=MessageRole.ASSISTANT, modality=MODALITY_VOICE, at=NOW)
    _run(db.commit())

    assert _count(db, parent) == 1


def test_typed_messages_are_not_billed_to_the_voice_quota(db):
    """NULL modality is every text turn and every row written before 0045."""
    parent = uuid4()
    conv = _seed(db, parent)
    for _ in range(5):
        _msg(db, conv, role=MessageRole.CHILD, modality=None, at=NOW)
    _run(db.commit())

    assert _count(db, parent) == 0


def test_yesterdays_turns_do_not_follow_the_child_into_today(db):
    """The ceiling renews at UTC midnight — that is the whole promise."""
    parent = uuid4()
    conv = _seed(db, parent)
    _msg(db, conv, role=MessageRole.CHILD, modality=MODALITY_VOICE,
         at=DAY_START - timedelta(seconds=1))
    _msg(db, conv, role=MessageRole.CHILD, modality=MODALITY_VOICE, at=DAY_START)
    _run(db.commit())

    # Only the one on today's side of midnight.
    assert _count(db, parent) == 1


def test_another_familys_turns_are_not_counted(db):
    """The ceiling is per parent, across their own children only."""
    mine, theirs = uuid4(), uuid4()
    my_conv = _seed(db, mine)
    their_conv = _seed(db, theirs)
    _msg(db, my_conv, role=MessageRole.CHILD, modality=MODALITY_VOICE, at=NOW)
    for _ in range(4):
        _msg(db, their_conv, role=MessageRole.CHILD, modality=MODALITY_VOICE, at=NOW)
    _run(db.commit())

    assert _count(db, mine) == 1
    assert _count(db, theirs) == 4


def test_all_of_one_parents_children_share_the_ceiling(db):
    """Two profiles under one account do not get two allowances."""
    parent = uuid4()
    first = _seed(db, parent)
    second = _seed(db, parent)
    _msg(db, first, role=MessageRole.CHILD, modality=MODALITY_VOICE, at=NOW)
    _msg(db, second, role=MessageRole.CHILD, modality=MODALITY_VOICE, at=NOW)
    _run(db.commit())

    assert _count(db, parent) == 2
