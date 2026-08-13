"""Goal-mate matching against a REAL async session.

There was no test of `find_goal_mates` at all, and it is the function that
decides which two children get introduced to each other. Every gate it is
supposed to apply is asserted here, including the two it was silently NOT
applying (the `matchable` publish gate, and confirmation on the caller's own
goal).

SQLite rather than Postgres so the suite needs no container — same approach
and same caveat as tests/api/test_note_api.py.
"""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from duyo.models.base import Base
from duyo.models.child import AgeSegment, ChildProfile, Language
from duyo.models.goal import ChildGoal, GoalCatalog, GoalKind, GoalSource, GoalStatus
from duyo.models.social import ChildSocialSettings, Friendship, FriendshipStatus
from duyo.models.user import User
from duyo.services.goal_matching import resolve_match_key
from duyo.services.social import find_goal_mates


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


_TABLES = (
    "users",
    "child_profiles",
    "goal_catalog",
    "child_goals",
    "child_social_settings",
    "friendships",
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


async def _catalog(session, key="test-naruto", *, matchable=True, active=True):
    entry = GoalCatalog(
        match_key=key, kind=GoalKind.OTHER, title="Naruto animesi",
        age_min=7, age_max=16, active=active, matchable=matchable,
    )
    session.add(entry)
    await session.flush()
    return entry


async def _child(session, name, age=14, *, discoverable=True, suspended=False):
    user = User(phone=f"+9989{uuid4().int % 10**8:08d}")
    session.add(user)
    await session.flush()
    child = ChildProfile(
        parent_id=user.id, name=name, age=age,
        age_segment=AgeSegment.from_age(age), language=Language.UZ, interests=[],
    )
    session.add(child)
    await session.flush()
    session.add(ChildSocialSettings(
        child_id=child.id, display_name=f"{name}-42",
        discoverable=discoverable,
        suspended_at=datetime.now(UTC) if suspended else None,
    ))
    await session.flush()
    return child


async def _goal(session, child, key, *, confirmed=True, status=GoalStatus.ACTIVE,
                title="Naruto"):
    goal = ChildGoal(
        child_id=child.id, kind=GoalKind.OTHER, title=title, match_key=key,
        status=status, source=GoalSource.CHILD_STATED,
        confirmed_at=datetime.now(UTC) if confirmed else None,
    )
    session.add(goal)
    await session.flush()
    return goal


async def _pair(session, **peer_kwargs):
    """Two 14-year-olds who both confirmed the same published goal."""
    entry = await _catalog(session)
    me = await _child(session, "Me")
    peer = await _child(session, "Peer", **peer_kwargs)
    await _goal(session, me, entry.match_key)
    await _goal(session, peer, entry.match_key)
    return me, peer, entry


# --- the happy path ---------------------------------------------------------


def test_two_children_sharing_a_published_goal_match(session):
    async def scenario():
        me, peer, _entry = await _pair(session)
        mates = await find_goal_mates(session, me)
        assert [p.id for p, _s, _e in mates] == [peer.id]
        # The catalogue row comes back so the caller can name the goal the way
        # a human wrote it, not "Test naruto".
        assert mates[0][2].title == "Naruto animesi"

    _run(scenario())


def test_matching_is_symmetric(session):
    async def scenario():
        me, peer, _ = await _pair(session)
        assert [p.id for p, _s, _e in await find_goal_mates(session, peer)] == [me.id]

    _run(scenario())


# --- the publish gate (was not enforced) ------------------------------------


def test_an_unreviewed_catalogue_entry_never_matches(session):
    """`matchable=False` is the human publish gate.

    It was checked on the anonymous count but NOT here, on the surface that
    introduces two children by name — so a catalogue row added later, which
    defaults to matchable=False, produced live suggestions anyway.
    """
    async def scenario():
        entry = await _catalog(session, matchable=False)
        me = await _child(session, "Me")
        peer = await _child(session, "Peer")
        await _goal(session, me, entry.match_key)
        await _goal(session, peer, entry.match_key)
        assert await find_goal_mates(session, me) == []

    _run(scenario())


def test_a_retired_catalogue_entry_never_matches(session):
    async def scenario():
        entry = await _catalog(session, active=False)
        me = await _child(session, "Me")
        peer = await _child(session, "Peer")
        await _goal(session, me, entry.match_key)
        await _goal(session, peer, entry.match_key)
        assert await find_goal_mates(session, me) == []

    _run(scenario())


# --- confirmation, both sides ----------------------------------------------


def test_an_unconfirmed_goal_of_MINE_does_not_match(session):
    """A goal DUYO guessed from conversation must not introduce the child to
    strangers before the child has agreed it is theirs."""
    async def scenario():
        entry = await _catalog(session)
        me = await _child(session, "Me")
        peer = await _child(session, "Peer")
        await _goal(session, me, entry.match_key, confirmed=False)
        await _goal(session, peer, entry.match_key)
        assert await find_goal_mates(session, me) == []

    _run(scenario())


def test_an_unconfirmed_goal_of_THEIRS_does_not_match(session):
    async def scenario():
        entry = await _catalog(session)
        me = await _child(session, "Me")
        peer = await _child(session, "Peer")
        await _goal(session, me, entry.match_key)
        await _goal(session, peer, entry.match_key, confirmed=False)
        assert await find_goal_mates(session, me) == []

    _run(scenario())


def test_a_completed_goal_does_not_match(session):
    async def scenario():
        entry = await _catalog(session)
        me = await _child(session, "Me")
        peer = await _child(session, "Peer")
        await _goal(session, me, entry.match_key)
        await _goal(session, peer, entry.match_key, status=GoalStatus.COMPLETED)
        assert await find_goal_mates(session, me) == []

    _run(scenario())


# --- discoverability and age ------------------------------------------------


def test_a_hidden_peer_never_matches(session):
    async def scenario():
        me, _peer, _ = await _pair(session, discoverable=False)
        assert await find_goal_mates(session, me) == []

    _run(scenario())


def test_a_suspended_peer_never_matches(session):
    async def scenario():
        me, _peer, _ = await _pair(session, suspended=True)
        assert await find_goal_mates(session, me) == []

    _run(scenario())


def test_more_than_one_year_apart_never_matches(session):
    async def scenario():
        entry = await _catalog(session)
        me = await _child(session, "Me", age=14)
        peer = await _child(session, "Peer", age=16)
        await _goal(session, me, entry.match_key)
        await _goal(session, peer, entry.match_key)
        assert await find_goal_mates(session, me) == []

    _run(scenario())


def test_across_the_age_segment_seam_never_matches(session):
    """13 and 14 are one year apart but in different segments — that boundary
    is exactly where an adult posing as a child would aim."""
    async def scenario():
        entry = await _catalog(session)
        me = await _child(session, "Me", age=13)     # EXPLORER
        peer = await _child(session, "Peer", age=14)  # COMPANION
        await _goal(session, me, entry.match_key)
        await _goal(session, peer, entry.match_key)
        assert await find_goal_mates(session, me) == []

    _run(scenario())


# --- existing edges ---------------------------------------------------------


@pytest.mark.parametrize(
    "state",
    [FriendshipStatus.PENDING, FriendshipStatus.ACCEPTED,
     FriendshipStatus.DECLINED, FriendshipStatus.BLOCKED],
)
def test_any_existing_edge_removes_the_peer_from_suggestions(session, state):
    """A blocked pair resurfacing as a suggestion would be the worst of these."""
    async def scenario():
        me, peer, _ = await _pair(session)
        low, high = sorted([me.id, peer.id], key=str)
        session.add(Friendship(
            child_low_id=low, child_high_id=high,
            requested_by_id=me.id, status=state,
        ))
        await session.flush()
        assert await find_goal_mates(session, me) == []

    _run(scenario())


def test_a_peer_is_listed_once_even_with_several_shared_goals(session):
    async def scenario():
        a = await _catalog(session, "test-naruto")
        b = await _catalog(session, "habit_har_kuni_kitob")
        me = await _child(session, "Me")
        peer = await _child(session, "Peer")
        for entry in (a, b):
            await _goal(session, me, entry.match_key, title=entry.match_key)
            await _goal(session, peer, entry.match_key, title=entry.match_key)
        mates = await find_goal_mates(session, me)
        assert [p.id for p, _s, _e in mates] == [peer.id]

    _run(scenario())


def test_a_child_never_matches_themselves(session):
    async def scenario():
        entry = await _catalog(session)
        me = await _child(session, "Me")
        await _goal(session, me, entry.match_key)
        assert await find_goal_mates(session, me) == []

    _run(scenario())


def test_no_key_no_match(session):
    """The production state before the fix: a freely typed goal with no key."""
    async def scenario():
        await _catalog(session)
        me = await _child(session, "Me")
        peer = await _child(session, "Peer")
        await _goal(session, me, None, title="Naruto")
        await _goal(session, peer, None, title="Naruto")
        assert await find_goal_mates(session, me) == []

    _run(scenario())


# --- the production scenario, end to end ------------------------------------


def test_two_children_who_TYPED_the_same_goal_now_match(session):
    """The exact failure this work started from.

    Three discoverable 14-year-olds each had a Naruto goal in the live
    database and none could see the others, because only one had come through
    the catalogue picker and the other two had typed it. With resolution in
    the create path, typing it is enough.
    """
    async def scenario():
        entry = await _catalog(session)
        me = await _child(session, "Me")
        peer = await _child(session, "Peer")

        # Neither child touched the picker; both wrote their own words.
        for child, typed in (
            (me, "Naruto"),
            (peer, "naruto animesini toliq korib chiqmoqchiman"),
        ):
            key = await resolve_match_key(session, typed, age=child.age)
            assert key == entry.match_key, (typed, key)
            await _goal(session, child, key, title=typed)

        assert [p.id for p, _s, _e in await find_goal_mates(session, me)] == [peer.id]

    _run(scenario())


def test_resolution_respects_the_publish_gate_against_a_real_session(session):
    """The SQL filters, not just the scoring — an unpublished entry is
    invisible to resolution even when the words match exactly."""
    async def scenario():
        await _catalog(session, "secret", matchable=False)
        assert await resolve_match_key(session, "Naruto animesi", age=14) is None

    _run(scenario())


def test_resolution_respects_the_age_band_against_a_real_session(session):
    async def scenario():
        entry = GoalCatalog(
            match_key="exam_ielts", kind=GoalKind.EXAM,
            title="IELTS imtihoniga tayyorgarlik",
            age_min=14, age_max=16, active=True, matchable=True,
        )
        session.add(entry)
        await session.flush()
        assert await resolve_match_key(session, "IELTS ga tayyorlanaman", age=10) is None
        assert await resolve_match_key(session, "IELTS ga tayyorlanaman", age=15) == "exam_ielts"

    _run(scenario())
