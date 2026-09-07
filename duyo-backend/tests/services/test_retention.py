"""The published retention period, asserted against the clock.

privacy.html promises peer and group messages live twelve months. Before
services/retention.py nothing deleted one, so the table said something about
children's data that was not true. These tests are what keep it true.
"""

from __future__ import annotations

import itertools
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from sqlalchemy import event, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from duyo.models.base import Base
from duyo.models.social import GroupMessage, PeerMessage
from duyo.services import retention

_seq = itertools.count(1)


@event.listens_for(GroupMessage, "before_insert", propagate=True)
def _fill_group_seq(_mapper, _conn, target: GroupMessage) -> None:
    if target.seq is None:
        target.seq = next(_seq)


@event.listens_for(PeerMessage, "before_insert", propagate=True)
def _fill_peer_seq(_mapper, _conn, target: PeerMessage) -> None:
    if getattr(target, "seq", None) is None:
        target.seq = next(_seq)


@pytest.fixture
async def session():
    """Async fixture, not the get_event_loop() helper the older files use.

    That helper reaches for a loop pytest-asyncio has already closed once the
    whole suite runs in one process, so the file passed alone and errored in
    the suite.
    """
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    tables = [Base.metadata.tables[n] for n in ("peer_messages", "group_messages")]
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all, tables=tables)
    s = async_sessionmaker(engine, expire_on_commit=False)()
    yield s
    await s.close()
    await engine.dispose()


NOW = datetime(2026, 9, 7, tzinfo=UTC)


def _aged(days: int):
    """A creation timestamp `days` in the past, relative to a fixed NOW."""
    return NOW - timedelta(days=days)


def _peer(session, days: int) -> PeerMessage:
    m = PeerMessage(friendship_id=uuid4(), sender_child_id=uuid4(), body=f"{days}")
    m.created_at = _aged(days)
    session.add(m)
    return m


def _group(session, days: int) -> GroupMessage:
    m = GroupMessage(group_key="kitoblar:companion", sender_name="Bek-17", body=f"{days}")
    m.created_at = _aged(days)
    session.add(m)
    return m


def test_the_cutoff_is_the_period_the_policy_publishes():
    assert retention.PEER_MESSAGE_RETENTION_DAYS == 365
    assert retention.cutoff(NOW) == NOW - timedelta(days=365)


async def test_messages_past_the_period_are_deleted(session):

    _peer(session, 400)
    _group(session, 400)
    await session.commit()

    removed = await retention.purge_expired_peer_messages(session, now=NOW)

    assert removed == {"peer_messages": 1, "group_messages": 1}
    assert (await session.scalars(select(PeerMessage))).all() == []
    assert (await session.scalars(select(GroupMessage))).all() == []



async def test_messages_inside_the_period_are_left_alone(session):
    """A conversation from last month is not old data."""


    _peer(session, 30)
    _group(session, 364)
    await session.commit()

    removed = await retention.purge_expired_peer_messages(session, now=NOW)

    assert removed == {"peer_messages": 0, "group_messages": 0}
    assert len((await session.scalars(select(PeerMessage))).all()) == 1
    assert len((await session.scalars(select(GroupMessage))).all()) == 1



async def test_the_boundary_keeps_a_message_exactly_on_the_line(session):
    """365 days old is still within twelve months; 366 is not."""


    _peer(session, 365)
    _peer(session, 366)
    await session.commit()

    removed = await retention.purge_expired_peer_messages(session, now=NOW)

    assert removed["peer_messages"] == 1
    survivors = (await session.scalars(select(PeerMessage))).all()
    assert [m.body for m in survivors] == ["365"]



async def test_the_dry_run_counts_without_deleting(session):
    """Counting is separate from deleting, so a sweep can be inspected first."""


    _peer(session, 500)
    _group(session, 500)
    _group(session, 10)
    await session.commit()

    counts = await retention.count_expired(session, now=NOW)

    assert counts == {"peer_messages": 1, "group_messages": 1}
    # Nothing moved.
    assert len((await session.scalars(select(GroupMessage))).all()) == 2



async def test_a_sweep_on_an_empty_database_is_a_no_op(session):

    removed = await retention.purge_expired_peer_messages(session, now=NOW)
    assert removed == {"peer_messages": 0, "group_messages": 0}

