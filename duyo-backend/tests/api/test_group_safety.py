"""Reporting and blocking inside a goal room.

Pre-delivery screening is a filter on words. These two routes are the child's
own control, and they exist for what a filter cannot judge, so the properties
worth asserting are the ones a distressed child depends on:

* a report reaches the SAME queue a one-to-one report does, carrying the
  message so a reviewer can act on it rather than on "A dislikes B";
* reporting stops the room showing that peer immediately, without waiting for
  a human;
* blocking works with no prior friendship, which is the normal case between
  two children who only share a room;
* a blocked peer's voice note stops being fetchable at the same instant their
  text stops being listed — the media URL is a plain GET a client may already
  hold.

Route functions are called directly with a real async session, as in
tests/api/test_group_notes.py, and on SQLite so the suite needs no container.
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
from duyo.models.base import Base
from duyo.models.child import AgeSegment, ChildProfile, Language
from duyo.models.goal import ChildGoal, GoalCatalog, GoalKind, GoalSource, GoalStatus
from duyo.models.social import (
    ChildSocialSettings,
    Friendship,
    FriendshipStatus,
    GroupMessage,
    PeerReport,
)
from duyo.models.user import User
from duyo.schemas.social import PeerReportCreate
from duyo.services.groups import category_of, group_key

_GOAL = "book_kichkina_shahzoda"


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


# Same reason as test_group_notes: `seq` is a Postgres IDENTITY column SQLite
# has no notion of, so the insert would arrive with seq=NULL.
_seq = itertools.count(1000)


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
    "friendships",
    "group_messages",
    "peer_reports",
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


async def _catalog(session) -> None:
    if await session.scalar(
        select(GoalCatalog).where(GoalCatalog.match_key == _GOAL)
    ):
        return
    session.add(
        GoalCatalog(
            match_key=_GOAL,
            kind=GoalKind.OTHER,
            title="Kichkina shahzoda",
            age_min=7,
            age_max=16,
            active=True,
            matchable=True,
        )
    )
    await session.flush()


async def _member(session, handle: str):
    """A 14-year-old in the room their goal and age put them in."""
    await _catalog(session)
    user = User(phone=f"+9989{uuid4().int % 10**8:08d}")
    session.add(user)
    await session.flush()
    child = ChildProfile(
        parent_id=user.id,
        name=handle,
        age=14,
        age_segment=AgeSegment.from_age(14),
        language=Language.UZ,
        interests=[],
    )
    session.add(child)
    await session.flush()
    session.add(
        ChildSocialSettings(child_id=child.id, display_name=handle, discoverable=True)
    )
    session.add(
        ChildGoal(
            child_id=child.id,
            kind=GoalKind.OTHER,
            title="Kichkina shahzoda",
            match_key=_GOAL,
            status=GoalStatus.ACTIVE,
            source=GoalSource.CHILD_STATED,
            confirmed_at=datetime.now(UTC),
        )
    )
    await session.flush()
    category = category_of(_GOAL)
    assert category is not None, "test goal must belong to a category"
    return user, child, group_key(category.key, child.age_segment)


async def _say(session, child, key, body, **media):
    message = GroupMessage(
        group_key=key, sender_child_id=child.id, sender_name=child.name, body=body,
        **media,
    )
    session.add(message)
    await session.flush()
    return message


async def _room(session, viewer_user, viewer, key):
    return await mod.list_group_messages(
        child_id=viewer.id,
        key=key,
        after_seq=0,
        current_user=viewer_user,
        db=session,
    )


def test_report_files_against_the_message_and_hides_the_sender(session):
    async def scenario():
        _, hurt, key = await _member(session, "Aziza-42")
        rude_user, rude, _ = await _member(session, "Bek-17")
        message = await _say(session, rude, key, "sen ahmoqsan")

        assert len(await _room(session, rude_user, rude, key)) == 1

        out = await mod.report_group_message(
            child_id=hurt.id,
            key=key,
            message_id=message.id,
            payload=PeerReportCreate(reason="rude_or_upsetting"),
            current_user=await session.get(User, hurt.parent_id),
            db=session,
        )
        assert out == {"status": "received"}

        report = await session.scalar(select(PeerReport))
        assert report is not None
        # The reviewer's queue needs the evidence, not just two names.
        assert report.group_message_id == message.id
        assert report.reported_child_id == rude.id
        assert report.reporter_child_id == hurt.id
        assert report.reason == "rude_or_upsetting"
        # No friendship existed, so a group report carries none — which is
        # exactly the case the nullable column is for.
        assert report.friendship_id is None

        # And the room stops showing them without waiting for a human.
        assert await _room(session, await session.get(User, hurt.parent_id), hurt, key) == []

    _run(scenario())


def test_blocking_needs_no_prior_friendship(session):
    async def scenario():
        _, me, key = await _member(session, "Aziza-42")
        noisy_user, noisy, _ = await _member(session, "Bek-17")
        await _say(session, noisy, key, "salom")
        await _say(session, me, key, "salom o'zingga")
        my_user = await session.get(User, me.parent_id)

        assert len(await _room(session, my_user, me, key)) == 2

        await mod.block_group_member(
            child_id=me.id,
            key=key,
            peer_child_id=noisy.id,
            current_user=my_user,
            db=session,
        )

        edge = await session.scalar(select(Friendship))
        assert edge is not None
        assert edge.status is FriendshipStatus.BLOCKED
        assert edge.blocked_by_id == me.id

        # Their message is gone; the child's own is untouched.
        mine = await _room(session, my_user, me, key)
        assert [m.sender_name for m in mine] == ["Aziza-42"]
        # Bilateral: the blocked child stops reaching them too, and is never
        # told which direction the block ran in — from their side the room
        # simply holds nobody but themselves.
        theirs = await _room(session, noisy_user, noisy, key)
        assert [m.sender_name for m in theirs] == ["Bek-17"]

    _run(scenario())


def test_a_blocked_peers_note_stops_streaming(session, monkeypatch):
    async def scenario():
        _, me, key = await _member(session, "Aziza-42")
        _, noisy, _ = await _member(session, "Bek-17")
        note = await _say(
            session, noisy, key, "salom", media_key="abc.webm", media_kind="audio"
        )
        my_user = await session.get(User, me.parent_id)

        monkeypatch.setattr(
            mod.storage, "get_object", lambda _key: (iter([b""]), "audio/webm", 0)
        )
        # Reachable before the block — otherwise the assertion below proves
        # nothing about the block.
        await mod.get_group_note_media(
            child_id=me.id, key=key, message_id=note.id,
            current_user=my_user, db=session,
        )

        await mod.block_group_member(
            child_id=me.id, key=key, peer_child_id=noisy.id,
            current_user=my_user, db=session,
        )

        with pytest.raises(HTTPException) as caught:
            await mod.get_group_note_media(
                child_id=me.id, key=key, message_id=note.id,
                current_user=my_user, db=session,
            )
        assert caught.value.status_code == 404

    _run(scenario())


def test_you_cannot_report_your_own_message(session):
    async def scenario():
        user, me, key = await _member(session, "Aziza-42")
        mine = await _say(session, me, key, "salom")

        with pytest.raises(HTTPException) as caught:
            await mod.report_group_message(
                child_id=me.id, key=key, message_id=mine.id,
                payload=PeerReportCreate(reason=None),
                current_user=user, db=session,
            )
        # 404, not 400 — existence never leaks. See the module docstring.
        assert caught.value.status_code == 404
        assert await session.scalar(select(PeerReport)) is None

    _run(scenario())


def test_a_message_from_another_room_is_not_reportable(session):
    async def scenario():
        user, me, key = await _member(session, "Aziza-42")
        _, stranger, _ = await _member(session, "Bek-17")
        elsewhere = await _say(session, stranger, "sport:companion", "salom")

        with pytest.raises(HTTPException) as caught:
            await mod.report_group_message(
                child_id=me.id, key=key, message_id=elsewhere.id,
                payload=PeerReportCreate(reason=None),
                current_user=user, db=session,
            )
        assert caught.value.status_code == 404

    _run(scenario())
