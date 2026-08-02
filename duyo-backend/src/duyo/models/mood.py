"""Daily mood check-in — the child's own answer to "how are you today?".

One row per child per day: re-tapping a different face on the same day updates
that day's row rather than appending, so the history stays one honest reading
per day instead of a log of indecision.

This is self-reported and deliberately coarse (five faces). It is a signal for
the parent report, never a diagnosis, and it is never shown back to the child
as a judgement.
"""

from datetime import date
from enum import Enum
from uuid import UUID

from sqlalchemy import Date, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import ENUM
from sqlalchemy.orm import Mapped, mapped_column

from duyo.models.base import UUIDPK, Base, TimestampMixin


class MoodValue(str, Enum):
    GREAT = "great"
    GOOD = "good"
    OKAY = "okay"
    SAD = "sad"
    STRESSED = "stressed"


# See models/child.py — force .value so the PG enum (lowercase) matches.
_mood_value_enum = ENUM(
    MoodValue,
    name="mood_value",
    create_type=False,
    values_callable=lambda enum_cls: [e.value for e in enum_cls],
)


class MoodEntry(Base, UUIDPK, TimestampMixin):
    __tablename__ = "mood_entries"
    __table_args__ = (
        UniqueConstraint("child_id", "entry_date", name="uq_mood_child_date"),
    )

    child_id: Mapped[UUID] = mapped_column(
        ForeignKey("child_profiles.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    # Stored as a date, not a timestamp: "today's mood" is a calendar question,
    # and a timestamp would make the daily uniqueness constraint impossible.
    entry_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    mood: Mapped[MoodValue] = mapped_column(_mood_value_enum, nullable=False)

    def __repr__(self) -> str:
        return f"<MoodEntry child={self.child_id} {self.entry_date} {self.mood.value}>"
