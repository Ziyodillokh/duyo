"""Chalkboard logic puzzles — one between chat turns, to break up the talking.

The catalogue is in services/puzzles.py; only attempts are stored. `correct_index`
never leaves the server on the way out, so the answer can't be read off the wire
before the child picks.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from duyo.api.deps import get_current_user, get_db
from duyo.models.child import ChildProfile
from duyo.models.puzzle import PuzzleAttempt
from duyo.models.user import User
from duyo.schemas.puzzle import PuzzleAnswerRequest, PuzzleAnswerResponse, PuzzleRead
from duyo.services import puzzles

router = APIRouter(prefix="/puzzles", tags=["puzzles"])


async def _owned_child(child_id: UUID, user: User, db: AsyncSession) -> ChildProfile:
    child = await db.scalar(
        select(ChildProfile).where(
            ChildProfile.id == child_id,
            (ChildProfile.parent_id == user.id) | (ChildProfile.child_user_id == user.id),
        )
    )
    if child is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Child not found")
    return child


@router.get("/next", response_model=PuzzleRead | None)
async def next_puzzle(
    child_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PuzzleRead | None:
    """The next unseen, age-appropriate puzzle — or null once they run out."""
    child = await _owned_child(child_id, current_user, db)

    seen = set(
        (
            await db.scalars(
                select(PuzzleAttempt.puzzle_id).where(PuzzleAttempt.child_id == child.id)
            )
        ).all()
    )
    puzzle = puzzles.pick_next(child.age_segment, seen)
    if puzzle is None:
        return None
    choices, _ = puzzles.presented(puzzle)
    return PuzzleRead(
        puzzle_id=puzzle.puzzle_id,
        text=puzzle.text,
        choices=list(choices),
        difficulty=puzzle.difficulty,
    )


@router.post("/{puzzle_id}/answer", response_model=PuzzleAnswerResponse)
async def answer_puzzle(
    puzzle_id: str,
    payload: PuzzleAnswerRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PuzzleAnswerResponse:
    """Record the child's pick and tell them how it went.

    Answering the same puzzle twice keeps the FIRST attempt: the explanation is
    shown right after answering, so a re-post could only be a retry with the
    answer already known.
    """
    child = await _owned_child(payload.child_id, current_user, db)

    puzzle = puzzles.get(puzzle_id)
    if puzzle is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Puzzle not found")

    # Compare against the SHUFFLED order the child was shown, not the
    # catalogue order — presented() reproduces it from the puzzle_id.
    _, shown_correct = puzzles.presented(puzzle)
    is_correct = payload.chosen_index == shown_correct

    existing = await db.scalar(
        select(PuzzleAttempt).where(
            PuzzleAttempt.child_id == child.id,
            PuzzleAttempt.puzzle_id == puzzle_id,
        )
    )
    if existing is None:
        db.add(PuzzleAttempt(
            child_id=child.id,
            puzzle_id=puzzle_id,
            chosen_index=payload.chosen_index,
            is_correct=is_correct,
            difficulty=puzzle.difficulty,
        ))
        await db.flush()

    return PuzzleAnswerResponse(
        is_correct=is_correct,
        correct_index=shown_correct,
        explanation=puzzle.explanation,
    )
