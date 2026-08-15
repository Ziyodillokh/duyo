"""ChildProfile — one or more per User."""

from enum import Enum
from uuid import UUID

from sqlalchemy import JSON, CheckConstraint, ForeignKey, String, text
from sqlalchemy.dialects.postgresql import ENUM, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from duyo.models.base import UUIDPK, Base, TimestampMixin


class AgeSegment(str, Enum):
    """Per Concept §3 — 3 age segments with distinct UX + system prompt."""

    JUNIOR = "junior"          # 7-10
    EXPLORER = "explorer"      # 11-13
    COMPANION = "companion"    # 14-16

    @classmethod
    def from_age(cls, age: int) -> "AgeSegment":
        if age < 7 or age > 16:
            raise ValueError(f"Age {age} outside DUYO supported range (7-16)")
        if age <= 10:
            return cls.JUNIOR
        if age <= 13:
            return cls.EXPLORER
        return cls.COMPANION


class Language(str, Enum):
    UZ = "uz"
    RU = "ru"
    EN = "en"


# SQLAlchemy defaults to enum.name; force .value so PG enum (lowercase) matches.
# create_type=False — migration already created the PG type.
_age_segment_enum = ENUM(
    AgeSegment,
    name="age_segment",
    create_type=False,
    values_callable=lambda enum_cls: [e.value for e in enum_cls],
)
_language_enum = ENUM(
    Language,
    name="language",
    create_type=False,
    values_callable=lambda enum_cls: [e.value for e in enum_cls],
)


class ChildProfile(Base, UUIDPK, TimestampMixin):
    __tablename__ = "child_profiles"
    __table_args__ = (
        CheckConstraint("age >= 7 AND age <= 16", name="ck_child_age_range"),
    )

    parent_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Set once the child claims their own account via a FamilyInvite (see
    # models/family_invite.py) — a second, independent User the child logs
    # into on their own device. Null means the family never linked one: the
    # profile is still fully usable, just self-managed from the parent's own
    # login the way every account worked before linking existed.
    child_user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        unique=True,
    )
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    age: Mapped[int] = mapped_column(nullable=False)
    age_segment: Mapped[AgeSegment] = mapped_column(_age_segment_enum, nullable=False)
    language: Mapped[Language] = mapped_column(_language_enum, nullable=False, default=Language.UZ)
    # What the child picked during onboarding. Interests steer conversation
    # topics; mascot is which body they chose ("duyo" or "raccoon"). Both were
    # collected and thrown away before this column existed.
    # JSONB in Postgres; plain JSON elsewhere so the SQLite-backed API tests
    # can still create this table (they build child_profiles for the FK).
    interests: Mapped[list[str]] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"),
        nullable=False,
        default=list,
        server_default=text("'[]'"),
    )
    mascot: Mapped[str | None] = mapped_column(String(32), nullable=True)

    # Explicit foreign_keys: child_user_id is a second FK to users.id, so
    # SQLAlchemy can no longer infer which column this relationship follows.
    parent: Mapped["User"] = relationship(  # noqa: F821
        back_populates="children", foreign_keys=[parent_id],
    )
    conversations: Mapped[list["Conversation"]] = relationship(  # noqa: F821
        back_populates="child",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<ChildProfile id={self.id} name={self.name} age={self.age}>"
