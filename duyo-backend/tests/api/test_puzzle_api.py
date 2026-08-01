"""Puzzle endpoints — ownership, no answer leak, first-attempt-wins."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from uuid import uuid4

import pytest
from fastapi import HTTPException

from duyo.api.v1 import puzzle as mod
from duyo.models.child import AgeSegment, ChildProfile, Language
from duyo.models.puzzle import PuzzleAttempt
from duyo.schemas.puzzle import PuzzleAnswerRequest
from duyo.services import puzzles


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


@dataclass
class _Scalars:
    rows: list

    def all(self):
        return list(self.rows)


@dataclass
class _FakeSession:
    scalar_queue: list = field(default_factory=list)
    scalars_rows: list = field(default_factory=list)
    added: list = field(default_factory=list)
    flushed: bool = False

    async def scalar(self, *_a, **_kw):
        return self.scalar_queue.pop(0)

    async def scalars(self, *_a, **_kw):
        return _Scalars(self.scalars_rows)

    def add(self, obj):
        self.added.append(obj)

    async def flush(self):
        self.flushed = True


@dataclass
class _User:
    id: object


def _child(parent_id):
    return ChildProfile(
        id=uuid4(), parent_id=parent_id, name="Aziza", age=11,
        age_segment=AgeSegment.EXPLORER, language=Language.UZ,
    )


# ── next ─────────────────────────────────────────────────────────────────────

def test_next_returns_a_puzzle_without_the_answer():
    user = _User(uuid4())
    child = _child(user.id)
    db = _FakeSession(scalar_queue=[child], scalars_rows=[])

    out = _run(mod.next_puzzle(child_id=child.id, current_user=user, db=db))

    assert out is not None
    assert out.choices
    # The correct index must not be reachable from the response model.
    assert not hasattr(out, "correct_index")
    assert not hasattr(out, "explanation")


def test_next_returns_none_when_catalogue_exhausted():
    user = _User(uuid4())
    child = _child(user.id)
    seen = [p.puzzle_id for p in puzzles.for_segment(AgeSegment.EXPLORER)]
    db = _FakeSession(scalar_queue=[child], scalars_rows=seen)

    assert _run(mod.next_puzzle(child_id=child.id, current_user=user, db=db)) is None


def test_next_rejects_another_familys_child():
    user = _User(uuid4())
    db = _FakeSession(scalar_queue=[None])
    with pytest.raises(HTTPException) as exc:
        _run(mod.next_puzzle(child_id=uuid4(), current_user=user, db=db))
    assert exc.value.status_code == 404


# ── answer ───────────────────────────────────────────────────────────────────

def _first_puzzle():
    return puzzles.for_segment(AgeSegment.EXPLORER)[0]


def test_correct_answer_is_recorded():
    user = _User(uuid4())
    child = _child(user.id)
    p = _first_puzzle()
    db = _FakeSession(scalar_queue=[child, None])  # owned child, no prior attempt

    out = _run(mod.answer_puzzle(
        p.puzzle_id, PuzzleAnswerRequest(child_id=child.id, chosen_index=p.correct_index),
        user, db,
    ))

    assert out.is_correct is True
    assert out.explanation == p.explanation
    assert len(db.added) == 1
    row = db.added[0]
    assert isinstance(row, PuzzleAttempt)
    assert row.difficulty == p.difficulty


def test_wrong_answer_still_returns_the_explanation():
    user = _User(uuid4())
    child = _child(user.id)
    p = _first_puzzle()
    wrong = (p.correct_index + 1) % len(p.choices)
    db = _FakeSession(scalar_queue=[child, None])

    out = _run(mod.answer_puzzle(
        p.puzzle_id, PuzzleAnswerRequest(child_id=child.id, chosen_index=wrong), user, db,
    ))

    assert out.is_correct is False
    assert out.correct_index == p.correct_index
    assert out.explanation


def test_re_answering_keeps_the_first_attempt():
    user = _User(uuid4())
    child = _child(user.id)
    p = _first_puzzle()
    existing = PuzzleAttempt(
        child_id=child.id, puzzle_id=p.puzzle_id, chosen_index=99,
        is_correct=False, difficulty=p.difficulty,
    )
    db = _FakeSession(scalar_queue=[child, existing])

    out = _run(mod.answer_puzzle(
        p.puzzle_id, PuzzleAnswerRequest(child_id=child.id, chosen_index=p.correct_index),
        user, db,
    ))

    assert out.is_correct is True       # the child still sees the truth
    assert db.added == []               # but the record is not rewritten
    assert existing.is_correct is False


def test_unknown_puzzle_is_404():
    user = _User(uuid4())
    child = _child(user.id)
    db = _FakeSession(scalar_queue=[child])
    with pytest.raises(HTTPException) as exc:
        _run(mod.answer_puzzle(
            "yoq-bunday-jumboq",
            PuzzleAnswerRequest(child_id=child.id, chosen_index=0), user, db,
        ))
    assert exc.value.status_code == 404
