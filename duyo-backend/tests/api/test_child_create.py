"""Child creation: stores the onboarding answers, and never twice.

Production accumulated six copies of one child because every pass through
onboarding POSTed another profile. Same parent, same name, same age is the
same child.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from uuid import uuid4

import pytest

from duyo.api.v1 import chat as chat_module
from duyo.models.child import AgeSegment, ChildProfile, Language
from duyo.models.family_invite import FamilyInvite
from duyo.schemas.chat import ChildCreate, ChildUpdate


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


@dataclass
class _FakeSession:
    """scalar() answers by query target: `select(ChildProfile)` gets
    `existing`, `select(FamilyInvite)` gets `invite` — default None, so every
    pre-existing test keeps meaning "not a linked account" without needing to
    know that lookup exists."""

    existing: ChildProfile | None = None
    invite: FamilyInvite | None = None
    added: list = field(default_factory=list)
    committed: int = 0

    async def scalar(self, stmt, *_a, **_kw):
        entity = stmt.column_descriptions[0]["entity"]
        return self.invite if entity is FamilyInvite else self.existing

    def add(self, obj):
        self.added.append(obj)

    async def commit(self):
        self.committed += 1

    async def refresh(self, _obj):
        pass

    async def flush(self):
        pass


@dataclass
class _FakeUser:
    id: object


def _child(parent_id, name="Aziza", age=14) -> ChildProfile:
    c = ChildProfile(
        parent_id=parent_id,
        name=name,
        age=age,
        age_segment=AgeSegment.from_age(age),
        language=Language.UZ,
        interests=[],
        mascot=None,
    )
    c.id = uuid4()
    return c


def _create(db, payload, user=None):
    user = user or _FakeUser(id=uuid4())
    return _run(chat_module.create_child(payload=payload, current_user=user, db=db))


# ── stores what onboarding collected ────────────────────────────────────────

def test_creates_child_with_interests_and_mascot():
    db = _FakeSession()
    child = _create(
        db,
        ChildCreate(
            name="Aziza", age=13, interests=["kosmos", "musiqa"], mascot="raccoon"
        ),
    )
    assert child.name == "Aziza"
    assert child.age_segment == AgeSegment.EXPLORER
    assert child.interests == ["kosmos", "musiqa"]
    assert child.mascot == "raccoon"
    assert db.added == [child]
    assert db.committed == 1


def test_interests_and_mascot_are_optional():
    child = _create(_FakeSession(), ChildCreate(name="Bek", age=14))
    assert child.interests == []
    assert child.mascot is None


def test_name_is_stripped_and_blank_rejected():
    child = _create(_FakeSession(), ChildCreate(name="  Aziza  ", age=14))
    assert child.name == "Aziza"
    with pytest.raises(ValueError):
        ChildCreate(name="   ", age=14)


# ── never twice ─────────────────────────────────────────────────────────────

def test_second_identical_create_returns_the_same_child():
    user = _FakeUser(id=uuid4())
    first = _child(user.id, "Aziza", 14)
    db = _FakeSession(existing=first)
    again = _create(db, ChildCreate(name="Aziza", age=14), user=user)
    assert again is first
    assert db.added == []


def test_repeat_create_is_case_and_space_insensitive():
    user = _FakeUser(id=uuid4())
    first = _child(user.id, "Aziza", 14)
    db = _FakeSession(existing=first)
    again = _create(db, ChildCreate(name="  aziza ", age=14), user=user)
    assert again is first
    assert db.added == []


def test_repeat_create_fills_in_answers_the_first_pass_missed():
    user = _FakeUser(id=uuid4())
    first = _child(user.id, "Aziza", 14)
    db = _FakeSession(existing=first)
    again = _create(
        db,
        ChildCreate(name="Aziza", age=14, interests=["sport"], mascot="duyo"),
        user=user,
    )
    assert again.interests == ["sport"]
    assert again.mascot == "duyo"
    assert db.committed == 1


def test_a_sibling_is_not_a_duplicate():
    """Only an exact name+age match is treated as the same child."""
    user = _FakeUser(id=uuid4())
    db = _FakeSession(existing=None)  # the query found no match for this name
    sibling = _create(db, ChildCreate(name="Bek", age=14), user=user)
    assert sibling.name == "Bek"
    assert db.added == [sibling]


# ── linked child (claimed FamilyInvite) ─────────────────────────────────────

def _claimed_invite(parent_id) -> FamilyInvite:
    invite = FamilyInvite(
        parent_id=parent_id, child_name="Aziza", child_phone="+998911112233",
        claimed=True,
    )
    invite.id = uuid4()
    return invite
def test_unlinked_child_still_owns_itself_as_before():
    """No claimed invite — legacy self-onboarding keeps working unchanged."""
    user = _FakeUser(id=uuid4())
    db = _FakeSession(existing=None, invite=None)

    child = _create(db, ChildCreate(name="Aziza", age=14), user=user)

    assert child.parent_id == user.id
    assert child.child_user_id is None
# ── update carries the same fields ──────────────────────────────────────────

def test_update_can_change_interests_and_mascot():
    user = _FakeUser(id=uuid4())
    child = _child(user.id)

    @dataclass
    class _Res:
        rows: list

        def scalar_one_or_none(self):
            return self.rows[0] if self.rows else None

    class _Sess(_FakeSession):
        async def execute(self, *_a, **_kw):
            return _Res([child])

    result = _run(
        chat_module.update_child(
            child_id=child.id,
            payload=ChildUpdate(interests=["kitob"], mascot="duyo"),
            current_user=user,
            db=_Sess(),
        )
    )
    assert result.interests == ["kitob"]
    assert result.mascot == "duyo"


def test_interest_list_is_bounded():
    with pytest.raises(ValueError):
        ChildCreate(name="Aziza", age=14, interests=[f"i{n}" for n in range(13)])
