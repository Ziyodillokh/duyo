"""The badge that stands beside a peer's name, against a REAL async session.

`badges_for` exists to answer for a whole list of children at once, and the
thing that would quietly break it — a peer with no ledger row, no streak row
or no messages silently dropping out of the result — is invisible without a
database to run it on. So this uses SQLite rather than a session double: same
approach and same caveat as tests/api/test_goal_mates.py.
"""

from __future__ import annotations

import asyncio
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from duyo.models.base import Base
from duyo.models.child import AgeSegment, ChildProfile, Language
from duyo.models.conversation import Conversation
from duyo.models.gamification import BallsTransaction, Streak
from duyo.models.message import Message, MessageRole
from duyo.models.user import User
from duyo.services.badges import badge_for, badges_for


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


_TABLES = (
    "users",
    "child_profiles",
    "balls_transactions",
    "streaks",
    "conversations",
    "messages",
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


# --- world building ---------------------------------------------------------


async def _child(session, name="Bola", age=14):
    user = User(phone=f"+9989{uuid4().int % 10**8:08d}")
    session.add(user)
    await session.flush()
    child = ChildProfile(
        parent_id=user.id,
        name=name,
        age=age,
        age_segment=AgeSegment.from_age(age),
        language=Language.UZ,
        interests=[],
    )
    session.add(child)
    await session.flush()
    return child


async def _balls(session, child, amount):
    session.add(
        BallsTransaction(
            child_id=child.id, amount=amount, reason="test", balance_after=amount
        )
    )
    await session.flush()


async def _streak(session, child, longest):
    session.add(
        Streak(child_id=child.id, current_streak=longest, longest_streak=longest)
    )
    await session.flush()


async def _messages(session, child, count, role=MessageRole.CHILD):
    conversation = Conversation(child_id=child.id)
    session.add(conversation)
    await session.flush()
    for i in range(count):
        session.add(
            Message(conversation_id=conversation.id, role=role, content=f"salom {i}")
        )
    await session.flush()


# --- what it answers --------------------------------------------------------


def test_a_child_with_nothing_wears_no_badge(session):
    """None, not a starter badge.

    A mark beside every name marks nobody, so the empty answer has to survive
    all the way out rather than being filled in with the lowest badge.
    """

    async def go():
        child = await _child(session)
        assert await badge_for(session, child.id) is None

    _run(go())


def test_the_rarest_earned_badge_wins(session):
    """A child who has earned four badges shows the rarest of the four.

    Not the newest and not the first in the catalogue — `_RANK` order.
    """

    async def go():
        child = await _child(session)
        await _messages(session, child, 12)  # first_chat + curious
        await _streak(session, child, 7)  # streak_3 + streak_7 (rank 6)
        assert await badge_for(session, child.id) == "streak_7"

    _run(go())


def test_level_comes_from_the_ledger_sum(session):
    """duyo_dust is level 3, and level is derived from the balls balance.

    500 is the level-3 threshold; the badge is reachable in no other way, so
    if the sum were read wrong this is the only test that would notice.
    """

    async def go():
        child = await _child(session)
        await _balls(session, child, 300)
        await _balls(session, child, 250)  # 550 total → level 3
        assert await badge_for(session, child.id) == "duyo_dust"

    _run(go())


def test_only_the_childs_own_messages_count(session):
    """DUYO's replies are not the child's achievement.

    Counting both would hand "50 ta xabar" to a child who wrote 25.
    """

    async def go():
        child = await _child(session)
        await _messages(session, child, 9, role=MessageRole.CHILD)
        await _messages(session, child, 40, role=MessageRole.ASSISTANT)
        # 9 own messages: first_chat earned, curious (10) not.
        assert await badge_for(session, child.id) == "first_chat"

    _run(go())


def test_every_id_asked_for_comes_back(session):
    """Including the ones with no rows anywhere.

    The caller indexes the result by child id while building a list of peer
    cards; a missing key there is a KeyError in the middle of a response.
    """

    async def go():
        rich = await _child(session, "Rich")
        await _streak(session, rich, 3)
        bare = await _child(session, "Bare")

        out = await badges_for(session, [rich.id, bare.id])

        assert set(out) == {rich.id, bare.id}
        assert out[rich.id] == "streak_3"
        assert out[bare.id] is None

    _run(go())


def test_one_child_asked_for_twice_is_answered_once(session):
    """Two peers can be the same child across two goals; the query must not
    fan out into duplicate rows or a duplicate key."""

    async def go():
        child = await _child(session)
        await _messages(session, child, 1)
        out = await badges_for(session, [child.id, child.id])
        assert out == {child.id: "first_chat"}

    _run(go())


def test_an_empty_list_asks_the_database_nothing(session):
    async def go():
        assert await badges_for(session, []) == {}

    _run(go())
