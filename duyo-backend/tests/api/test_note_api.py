"""Note endpoints against a REAL async session.

The rest of the API tests use a fake session, which is fine for routing and
ownership but cannot catch anything about how SQLAlchemy's async layer
behaves. It missed a live 500: `updated_at` is `onupdate=func.now()`, so after
an UPDATE the attribute is expired and reading it lazily raises
MissingGreenlet — every note edit failed while the unit tests stayed green.

SQLite rather than Postgres so the suite needs no container. It reproduces the
expiry faithfully because `onupdate` is a SQL expression on any backend; where
a test would depend on Postgres specifics it belongs elsewhere.
"""

from __future__ import annotations

import asyncio
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from duyo.api.v1 import note as mod
from duyo.crisis.detector import KeywordCrisisDetector
from duyo.models.base import Base
from duyo.models.child import AgeSegment, ChildProfile, Language
from duyo.models.user import User
from duyo.schemas.note import LinkMentionRequest, NoteCreate, NoteUpdate, TagRename


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


@pytest.fixture
def session_factory():
    """A fresh in-memory database per test, with every table created."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")

    # Only the three tables notes touch. create_all() over the whole metadata
    # fails on SQLite, which has no JSONB — and pulling in unrelated tables
    # would make this fixture break whenever some other model changes.
    tables = [
        Base.metadata.tables[name]
        for name in ("users", "child_profiles", "child_notes")
    ]

    async def build():
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all, tables=tables)
        return async_sessionmaker(engine, expire_on_commit=False)

    factory = _run(build())
    yield factory
    _run(engine.dispose())


@pytest.fixture
def world(session_factory):
    """A parent, a child and an open session — the minimum a note needs."""

    async def build():
        db = session_factory()
        user = User(id=uuid4(), phone="+998900000000")
        child = ChildProfile(
            id=uuid4(),
            parent_id=user.id,
            name="Ali",
            age=12,
            age_segment=AgeSegment.EXPLORER,
            language=Language.UZ,
        )
        db.add_all([user, child])
        await db.flush()
        return db, user, child

    db, user, child = _run(build())
    yield db, user, child
    _run(db.close())


@pytest.fixture
def detector():
    return KeywordCrisisDetector()


def _create(db, user, child, title, body, detector):
    return _run(
        mod.create_note(
            NoteCreate(child_id=child.id, title=title, body=body),
            current_user=user,
            db=db,
            detector=detector,
        )
    )


def test_updating_a_note_returns_it_instead_of_raising(world, detector):
    """The regression: PUT /notes/{id} 500'd on MissingGreenlet."""
    db, user, child = world
    note = _create(db, user, child, "Kosmos", "Yulduzlar.", detector)

    updated = _run(
        mod.update_note(
            note.id,
            NoteUpdate(body="Yulduzlar juda uzoq."),
            current_user=user,
            db=db,
            detector=detector,
        )
    )
    assert updated.body == "Yulduzlar juda uzoq."
    assert updated.updated_at is not None


def test_creating_a_note_returns_populated_timestamps(world, detector):
    db, user, child = world
    note = _create(db, user, child, "Quyosh", "Issiq.", detector)
    assert note.created_at is not None and note.updated_at is not None


def test_link_mention_rewrites_the_source_note(world, detector):
    db, user, child = world
    target = _create(db, user, child, "Vulqon", "Lava issiq.", detector)
    source = _create(db, user, child, "Dinozavr", "Vulqon yonida yashagan.", detector)

    out = _run(
        mod.link_mention(
            target.id,
            LinkMentionRequest(source_id=source.id),
            current_user=user,
            db=db,
        )
    )
    assert out.id == source.id
    assert "[[Vulqon]]" in out.body


def test_unlinked_mentions_lists_prose_only(world, detector):
    db, user, child = world
    target = _create(db, user, child, "Vulqon", "Lava.", detector)
    _create(db, user, child, "Dinozavr", "Vulqon yonida yashagan.", detector)
    _create(db, user, child, "Orol", "[[Vulqon]] bor edi.", detector)

    found = _run(mod.unlinked_mentions(target.id, current_user=user, db=db))
    assert [m.title for m in found] == ["Dinozavr"]


def test_rename_tag_rewrites_every_note_and_counts_them(world, detector):
    db, user, child = world
    _create(db, user, child, "Bir", "matn #kosmoss", detector)
    _create(db, user, child, "Ikki", "boshqa #kosmoss", detector)
    _create(db, user, child, "Uch", "tegsiz", detector)

    changed = _run(
        mod.rename_tag(
            TagRename(child_id=child.id, old="kosmoss", new="kosmos"),
            current_user=user,
            db=db,
        )
    )
    assert changed == 2
    listed = _run(mod.list_notes(child.id, tag="kosmos", current_user=user, db=db))
    assert {n.title for n in listed} == {"Bir", "Ikki"}


def test_list_sort_by_title(world, detector):
    db, user, child = world
    for t in ("Vulqon", "Aziza", "Kosmos"):
        _create(db, user, child, t, "matn", detector)
    listed = _run(mod.list_notes(child.id, sort="title", current_user=user, db=db))
    assert [n.title for n in listed] == ["Aziza", "Kosmos", "Vulqon"]


def test_another_parents_note_is_not_reachable(world, session_factory, detector):
    db, user, child = world
    note = _create(db, user, child, "Shaxsiy", "matn", detector)
    stranger = User(id=uuid4(), phone="+998900000001")

    with pytest.raises(Exception) as exc:
        _run(mod.get_note(note.id, current_user=stranger, db=db))
    assert "404" in str(exc.value) or "not found" in str(exc.value).lower()
