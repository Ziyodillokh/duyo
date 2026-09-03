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
        # 13, not 7. A target audience that includes under-13s puts the app
        # under Google Play's Families Policy and under COPPA, which requires
        # verifiable parental consent before collecting personal information
        # from a child — and DUYO takes a phone number, a name, an age, chat
        # content, voice and a photo, with no parent account.
        #
        # Existing profiles below 13 are untouched: this bounds creation and
        # age edits, not reads. JUNIOR is therefore unreachable for a new
        # child and is kept for those rows and for content tagged to it.
        if age < 13 or age > 16:
            raise ValueError(f"Age {age} outside DUYO supported range (13-16)")
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
    # 13, matching AgeSegment.from_age and the 13+ content rating the app is
    # published under. The old floor of 7 outlived the decision by a release: a
    # database that still accepts an eight-year-old is the thing that makes the
    # store declaration untrue, whatever the client's ruler renders.
    __table_args__ = (
        CheckConstraint("age >= 13 AND age <= 16", name="ck_child_age_range"),
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

    # The child's own photo, if they uploaded one — an object key in the
    # media bucket, never a URL. Keys are how the rest of the app stores
    # uploads (see core/storage.py) so the bucket can move without a
    # rewrite of every row.
    #
    # It is NOT shown to peers. schemas/social.py is the only shape another
    # child ever sees and it carries a pseudonym and an age band; a face is
    # exactly what that file exists to keep out.
    photo_key: Mapped[str | None] = mapped_column(String(120), nullable=True)

    # Explicit foreign_keys: child_user_id is a second FK to users.id, so
    # SQLAlchemy can no longer infer which column this relationship follows.
    parent: Mapped["User"] = relationship(  # noqa: F821
        back_populates="children", foreign_keys=[parent_id],
    )
    conversations: Mapped[list["Conversation"]] = relationship(  # noqa: F821
        back_populates="child",
        cascade="all, delete-orphan",
    )

    @property
    def photo_url(self) -> str | None:
        """Where the app fetches the photo, or None if there is none.

        A property rather than something the routes fill in: every child
        route returns the ORM object and lets `ChildRead.from_attributes`
        do the rest, so a field the routes have to remember to set is a
        field that ships as null from whichever route was overlooked.

        It points at the AUTHENTICATED route, not at the public
        /v1/content/media/{key} one. An unguessable key is not access
        control — it leaks through logs, referrers and shared links — and
        that route even sends `Cache-Control: public`. Fine for a book
        cover; not for a child's face.

        The key rides along as `v` so a new photo is a new URL. Without it
        the address never changes and every cache in the path keeps
        serving the picture the child just replaced.
        """
        if not self.photo_key:
            return None
        # Imported here, not at module scope: models are imported by
        # alembic and by scripts that have no app settings loaded.
        from duyo.core.config import get_settings

        base = get_settings().public_base_url.rstrip("/")
        return f"{base}/v1/chat/children/{self.id}/photo?v={self.photo_key}"

    def __repr__(self) -> str:
        return f"<ChildProfile id={self.id} name={self.name} age={self.age}>"
