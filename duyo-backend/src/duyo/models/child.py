"""ChildProfile — one or more per User."""

from enum import Enum
from uuid import UUID

from sqlalchemy import CheckConstraint, ForeignKey, String
from sqlalchemy.dialects.postgresql import ENUM
from sqlalchemy.orm import Mapped, mapped_column, relationship

from duyo.models.base import Base, TimestampMixin, UUIDPK


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
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    age: Mapped[int] = mapped_column(nullable=False)
    age_segment: Mapped[AgeSegment] = mapped_column(_age_segment_enum, nullable=False)
    language: Mapped[Language] = mapped_column(_language_enum, nullable=False, default=Language.UZ)

    parent: Mapped["User"] = relationship(back_populates="children")  # noqa: F821
    conversations: Mapped[list["Conversation"]] = relationship(  # noqa: F821
        back_populates="child",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<ChildProfile id={self.id} name={self.name} age={self.age}>"
