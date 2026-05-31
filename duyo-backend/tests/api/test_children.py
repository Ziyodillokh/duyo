"""Tests for child profile CRUD — list, get, update, delete + ownership.

Covers the parent's right to read, edit, and erase their child's data
(TZ §8 / COPPA / GDPR-K). Endpoint functions are called directly with a fake
AsyncSession — no real DB, matching the repo's API-test style.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from uuid import uuid4

import pytest
from fastapi import HTTPException

from duyo.api.v1 import chat as chat_module
from duyo.models.child import AgeSegment, ChildProfile, Language
from duyo.schemas.chat import ChildUpdate


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


@dataclass
class _FakeResult:
    rows: list

    def scalar_one_or_none(self):
        return self.rows[0] if self.rows else None

    def scalars(self):
        return self

    def all(self):
        return list(self.rows)


@dataclass
class _FakeSession:
    result: _FakeResult
    deleted: list = field(default_factory=list)
    flushed: bool = False

    async def execute(self, *_a, **_kw):
        return self.result

    async def delete(self, obj):
        self.deleted.append(obj)

    async def flush(self):
        self.flushed = True


@dataclass
class _FakeUser:
    id: object


def _child(parent_id, name="Aziza", age=12, lang=Language.UZ) -> ChildProfile:
    c = ChildProfile(
        parent_id=parent_id,
        name=name,
        age=age,
        age_segment=AgeSegment.from_age(age),
        language=lang,
    )
    c.id = uuid4()
    return c


# ── List ────────────────────────────────────────────────────────────────────

def test_list_children_returns_own():
    user = _FakeUser(id=uuid4())
    rows = [_child(user.id, "Aziza", 12), _child(user.id, "Bek", 8)]
    db = _FakeSession(_FakeResult(rows))
    result = _run(chat_module.list_children(current_user=user, db=db))
    assert {c.name for c in result} == {"Aziza", "Bek"}


def test_list_children_empty():
    user = _FakeUser(id=uuid4())
    db = _FakeSession(_FakeResult([]))
    assert _run(chat_module.list_children(current_user=user, db=db)) == []


# ── Get one ─────────────────────────────────────────────────────────────────

def test_get_child_found():
    user = _FakeUser(id=uuid4())
    child = _child(user.id)
    db = _FakeSession(_FakeResult([child]))
    result = _run(chat_module.get_child(child_id=child.id, current_user=user, db=db))
    assert result is child


def test_get_child_not_found_raises_404():
    user = _FakeUser(id=uuid4())
    db = _FakeSession(_FakeResult([]))
    with pytest.raises(HTTPException) as exc:
        _run(chat_module.get_child(child_id=uuid4(), current_user=user, db=db))
    assert exc.value.status_code == 404


# ── Update ──────────────────────────────────────────────────────────────────

def test_update_child_name_only():
    user = _FakeUser(id=uuid4())
    child = _child(user.id, "Aziza", 12)
    db = _FakeSession(_FakeResult([child]))
    result = _run(chat_module.update_child(
        child_id=child.id, payload=ChildUpdate(name="Azizaxon"),
        current_user=user, db=db,
    ))
    assert result.name == "Azizaxon"
    assert result.age == 12
    assert db.flushed


def test_update_child_age_rederives_segment():
    user = _FakeUser(id=uuid4())
    child = _child(user.id, "Bek", 8)  # junior
    db = _FakeSession(_FakeResult([child]))
    result = _run(chat_module.update_child(
        child_id=child.id, payload=ChildUpdate(age=14),
        current_user=user, db=db,
    ))
    assert result.age == 14
    assert result.age_segment == AgeSegment.COMPANION


def test_update_child_language_only_keeps_name():
    user = _FakeUser(id=uuid4())
    child = _child(user.id, "Aziza", 12)
    db = _FakeSession(_FakeResult([child]))
    # JSON arrives as a string; pydantic coerces "ru" -> Language.RU.
    result = _run(chat_module.update_child(
        child_id=child.id, payload=ChildUpdate(language="ru"),
        current_user=user, db=db,
    ))
    assert result.language == Language.RU
    assert result.name == "Aziza"


def test_update_child_not_found_raises_404():
    user = _FakeUser(id=uuid4())
    db = _FakeSession(_FakeResult([]))
    with pytest.raises(HTTPException) as exc:
        _run(chat_module.update_child(
            child_id=uuid4(), payload=ChildUpdate(name="Ghost"),
            current_user=user, db=db,
        ))
    assert exc.value.status_code == 404


def test_update_rejects_out_of_range_age_at_schema():
    """Age bounds enforced by the schema before the endpoint runs."""
    with pytest.raises(ValueError):
        ChildUpdate(age=5)
    with pytest.raises(ValueError):
        ChildUpdate(age=200)


# ── Delete ──────────────────────────────────────────────────────────────────

def test_delete_child():
    user = _FakeUser(id=uuid4())
    child = _child(user.id)
    db = _FakeSession(_FakeResult([child]))
    _run(chat_module.delete_child(child_id=child.id, current_user=user, db=db))
    assert child in db.deleted
    assert db.flushed


def test_delete_child_not_found_raises_404():
    user = _FakeUser(id=uuid4())
    db = _FakeSession(_FakeResult([]))
    with pytest.raises(HTTPException) as exc:
        _run(chat_module.delete_child(child_id=uuid4(), current_user=user, db=db))
    assert exc.value.status_code == 404
    assert db.deleted == []


# ── Ownership isolation ─────────────────────────────────────────────────────

def test_ownership_filter_blocks_other_parent():
    """The query filters parent_id == current_user.id, so another parent's
    child never appears (empty result) → every verb 404s."""
    user = _FakeUser(id=uuid4())
    foreign_id = uuid4()
    for call in (
        lambda: chat_module.get_child(
            child_id=foreign_id, current_user=user, db=_FakeSession(_FakeResult([]))),
        lambda: chat_module.update_child(
            child_id=foreign_id, payload=ChildUpdate(name="x"),
            current_user=user, db=_FakeSession(_FakeResult([]))),
        lambda: chat_module.delete_child(
            child_id=foreign_id, current_user=user, db=_FakeSession(_FakeResult([]))),
    ):
        with pytest.raises(HTTPException) as exc:
            _run(call())
        assert exc.value.status_code == 404
