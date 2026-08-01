"""Chalkboard logic-puzzle schemas."""

from uuid import UUID

from pydantic import BaseModel, Field


class PuzzleRead(BaseModel):
    """A puzzle as the child sees it — no correct_index, that stays server-side."""

    puzzle_id: str
    text: str
    choices: list[str]
    difficulty: int


class PuzzleAnswerRequest(BaseModel):
    child_id: UUID
    chosen_index: int = Field(ge=0, le=9)


class PuzzleAnswerResponse(BaseModel):
    is_correct: bool
    correct_index: int
    explanation: str
