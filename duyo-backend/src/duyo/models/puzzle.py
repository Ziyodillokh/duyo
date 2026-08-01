"""PuzzleAttempt — one answer to a chalkboard logic puzzle.

Only attempts are stored; the puzzles themselves live in code
(services/puzzles.py), so the catalogue can be edited without a migration.

One row per (child, puzzle): a puzzle is shown once and not repeated, so a
second answer to the same item would be a bug rather than a retry.
"""

from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from duyo.models.base import UUIDPK, Base, TimestampMixin


class PuzzleAttempt(Base, UUIDPK, TimestampMixin):
    __tablename__ = "puzzle_attempts"
    __table_args__ = (
        UniqueConstraint("child_id", "puzzle_id", name="uq_puzzle_child_item"),
    )

    child_id: Mapped[UUID] = mapped_column(
        ForeignKey("child_profiles.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    # Matches services/puzzles.py Puzzle.puzzle_id — a code key, not a FK.
    puzzle_id: Mapped[str] = mapped_column(String(60), nullable=False)
    chosen_index: Mapped[int] = mapped_column(Integer, nullable=False)
    is_correct: Mapped[bool] = mapped_column(Boolean, nullable=False)
    # Snapshotted so past attempts keep their weight if the catalogue is retuned.
    difficulty: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    def __repr__(self) -> str:
        return f"<PuzzleAttempt {self.puzzle_id} correct={self.is_correct}>"
