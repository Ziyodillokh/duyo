"""Child goals — what a child is working toward, remembered across conversations.

DUYO has no cross-conversation memory today: prompt history is capped at the
last N messages of the SAME conversation, and the only durable per-child signal
is the 10-day parent report, whose prompt deliberately destroys specifics
("topics — yuqori daraja … aniq matn emas"). So "O'tkan Kunlar o'qiyapman"
becomes "hobbi" and then expires. These tables are that missing memory.

Three tables, deliberately separate:

- `goal_catalog` — a CURATED list of goals children can share. `match_key` is
  the only thing two children are ever compared on. Nothing in it is visible to
  peers until a human sets `matchable`, mirroring how content_items gates
  publishing behind review.
- `child_goals` — one child's goal, in the child's own words, with progress.
  The free-text `title` personalizes DUYO's replies; it is never a match key
  and never shown to another child, because child-authored text would otherwise
  become an unmoderated broadcast ("...telegramim @x, 42-maktabdaman").
- `child_goal_events` — append-only progress log ("10-betdaman"), so a wrong
  entry never silently rewrites history.
"""

from datetime import datetime
from enum import Enum
from uuid import UUID

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    text,
)
from sqlalchemy.dialects.postgresql import ENUM, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from duyo.models.base import UUIDPK, Base, TimestampMixin


class GoalKind(str, Enum):
    BOOK = "book"            # "O'tkan Kunlar romanini o'qish"
    TEXTBOOK = "textbook"    # "6-sinf fizika darsligini tugatish"
    SKILL = "skill"          # "ingliz tilida gapirishni o'rganish"
    EXAM = "exam"            # "DTM matematikaga tayyorlanish"
    HABIT = "habit"          # "har kuni kitob o'qish"
    OTHER = "other"


class GoalStatus(str, Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    PAUSED = "paused"
    ABANDONED = "abandoned"


class GoalSource(str, Enum):
    CHILD_STATED = "child_stated"  # the child said it in conversation
    PARENT_SET = "parent_set"
    ONBOARDING = "onboarding"      # derived from the interests picker
    INFERRED = "inferred"          # extractor guessed; needs confirming


# See models/child.py — force .value so the PG enum (lowercase) matches.
def _enum(enum_cls: type[Enum], name: str) -> ENUM:
    return ENUM(
        enum_cls,
        name=name,
        create_type=False,
        values_callable=lambda cls: [e.value for e in cls],
    )


_goal_kind_enum = _enum(GoalKind, "goal_kind")
_goal_status_enum = _enum(GoalStatus, "goal_status")
_goal_source_enum = _enum(GoalSource, "goal_source")


class GoalCatalog(Base, UUIDPK, TimestampMixin):
    """Curated goals. `match_key` is the ONLY axis two children are compared on."""

    __tablename__ = "goal_catalog"

    match_key: Mapped[str] = mapped_column(String(80), nullable=False, unique=True)
    kind: Mapped[GoalKind] = mapped_column(_goal_kind_enum, nullable=False)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    # Structured target, e.g. {"subject": "fizika", "grade": 6} — fed straight
    # into the textbook retriever so the goal actually steers help, not just
    # small talk.
    target_ref: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    age_min: Mapped[int] = mapped_column(Integer, nullable=False, default=7)
    age_max: Mapped[int] = mapped_column(Integer, nullable=False, default=16)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    # Publish gate for the social surface — mirrors content_items' review gate.
    # Nothing becomes discoverable to other children until a human flips this.
    matchable: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    reviewed_by: Mapped[str | None] = mapped_column(String(255), nullable=True)

    def __repr__(self) -> str:
        return f"<GoalCatalog {self.match_key} matchable={self.matchable}>"


class ChildGoal(Base, UUIDPK, TimestampMixin):
    __tablename__ = "child_goals"
    __table_args__ = (
        # One active goal per catalogue entry per child. Partial, so a child may
        # re-read the same book years later once the first attempt is closed.
        Index(
            "uq_child_goal_active_key",
            "child_id",
            "match_key",
            unique=True,
            postgresql_where=text("status = 'active' AND match_key IS NOT NULL"),
        ),
        Index("ix_child_goals_child_status", "child_id", "status"),
    )

    child_id: Mapped[UUID] = mapped_column(
        ForeignKey("child_profiles.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    kind: Mapped[GoalKind] = mapped_column(_goal_kind_enum, nullable=False)
    # The child's own words — personalizes DUYO's replies. NEVER a match key,
    # NEVER shown to another child.
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    target_ref: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    # SET NULL, not CASCADE: retiring a catalogue entry must make the goal
    # undiscoverable, never delete the child's goal.
    match_key: Mapped[str | None] = mapped_column(
        ForeignKey("goal_catalog.match_key", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    status: Mapped[GoalStatus] = mapped_column(
        _goal_status_enum, nullable=False, default=GoalStatus.ACTIVE
    )
    source: Mapped[GoalSource] = mapped_column(_goal_source_enum, nullable=False)
    # Null while an extractor guess awaits the child's yes. Unconfirmed goals
    # never reach the prompt — DUYO must not act on something it invented.
    confirmed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Progress is unit-agnostic: pages, chapters, lessons, days.
    unit_label: Mapped[str | None] = mapped_column(String(24), nullable=True)
    current_unit: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total_units: Mapped[int | None] = mapped_column(Integer, nullable=True)
    progress_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    last_progress_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    target_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    def __repr__(self) -> str:
        return f"<ChildGoal child={self.child_id} {self.title!r} {self.status.value}>"


class ChildGoalEvent(Base, UUIDPK, TimestampMixin):
    """Append-only progress log. Never updated, so history cannot be rewritten."""

    __tablename__ = "child_goal_events"

    goal_id: Mapped[UUID] = mapped_column(
        ForeignKey("child_goals.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    # Denormalised so a per-child activity query needs no join.
    child_id: Mapped[UUID] = mapped_column(
        ForeignKey("child_profiles.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    unit_value: Mapped[int | None] = mapped_column(Integer, nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[GoalSource] = mapped_column(_goal_source_enum, nullable=False)

    def __repr__(self) -> str:
        return f"<ChildGoalEvent goal={self.goal_id} unit={self.unit_value}>"
