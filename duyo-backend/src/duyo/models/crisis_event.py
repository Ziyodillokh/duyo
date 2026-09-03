"""CrisisEvent — audit trail for safety detection (legal retention: 7 years).

The retention outlives the account: deleting a family de-identifies these rows
rather than removing them. See `CrisisEvent.child_id`.
"""

from datetime import datetime
from enum import Enum
from uuid import UUID

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import ENUM, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from duyo.models.base import UUIDPK, Base, TimestampMixin


class CrisisLevel(str, Enum):
    """Per TZ §9.4 — risk level escalation ladder."""

    GREEN = "GREEN"      # safe
    YELLOW = "YELLOW"    # passive negative
    ORANGE = "ORANGE"    # self-harm / abuse → parent SMS within 24h
    RED = "RED"          # imminent risk → immediate SMS + call


#: Severity order, lowest first. Every detection layer is escalate-only, so
#: combining layers is always "take the highest" — this is the one definition
#: of what "highest" means.
_SEVERITY: dict["CrisisLevel", int] = {
    CrisisLevel.GREEN: 0,
    CrisisLevel.YELLOW: 1,
    CrisisLevel.ORANGE: 2,
    CrisisLevel.RED: 3,
}


def severity(level: CrisisLevel) -> int:
    """Rank for comparison. See `_SEVERITY`."""
    return _SEVERITY[level]


def highest(*levels: CrisisLevel) -> CrisisLevel:
    """The most severe of `levels` — how independent layers are combined.

    A downgrade is never possible through this function, which is the safety
    property every layer's docstring promises individually.
    """
    return max(levels, key=severity)


# CrisisLevel.name == .value (both uppercase) so the default mapping is fine,
# but we still set create_type=False so SQLAlchemy doesn't try to recreate it.
_crisis_level_enum = ENUM(
    CrisisLevel,
    name="crisis_level",
    create_type=False,
    values_callable=lambda enum_cls: [e.value for e in enum_cls],
)


class CrisisEvent(Base, UUIDPK, TimestampMixin):
    __tablename__ = "crisis_events"

    message_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("messages.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    # SET NULL, not CASCADE, and nullable. The safety audit trail is kept for
    # seven years, and account deletion must not be a way to erase it — but
    # what stays is the DETECTION, not the person: level, layer, the matched
    # keywords and the timestamps, with every link to the family removed
    # (message_id was already SET NULL and the message itself is gone).
    #
    # A null child_id therefore means exactly one thing: this family deleted
    # their account. See services/account_deletion.py.
    child_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("child_profiles.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    level: Mapped[CrisisLevel] = mapped_column(_crisis_level_enum, nullable=False)
    # 1=keyword, 2=Gemini classifier, 3=semantic/embedding classifier
    # (crisis/semantic.py — a trained model can replace it later), 4=human review
    layer: Mapped[int] = mapped_column(Integer, nullable=False)

    # JSONB list of {keyword, category, language} from Layer 1, or {confidence, reasoning} from Layer 2.
    # JSONB on Postgres; plain JSON elsewhere so SQLite-backed API tests can
    # create this table (models/child.py and models/goal.py do the same).
    # Identical column type in production.
    matches: Mapped[list[dict] | None] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"), nullable=True
    )

    parent_notified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    parent_notified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Admin triage: null reviewed_at = open; reviewed_by snapshots the admin email.
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reviewed_by: Mapped[str | None] = mapped_column(String(255), nullable=True)

    message: Mapped["Message | None"] = relationship(back_populates="crisis_events")  # noqa: F821

    def __repr__(self) -> str:
        return (
            f"<CrisisEvent id={self.id} level={self.level.value} layer={self.layer} "
            f"notified={self.parent_notified}>"
        )
