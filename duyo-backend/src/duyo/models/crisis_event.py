"""CrisisEvent — audit trail for safety detection (legal retention: 7 years)."""

from datetime import datetime
from enum import Enum
from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import ENUM, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from duyo.models.base import UUIDPK, Base, TimestampMixin


class CrisisLevel(str, Enum):
    """Per TZ §9.4 — risk level escalation ladder."""

    GREEN = "GREEN"      # safe
    YELLOW = "YELLOW"    # passive negative
    ORANGE = "ORANGE"    # self-harm / abuse → parent SMS within 24h
    RED = "RED"          # imminent risk → immediate SMS + call


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
    child_id: Mapped[UUID] = mapped_column(
        ForeignKey("child_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    level: Mapped[CrisisLevel] = mapped_column(_crisis_level_enum, nullable=False)
    # 1=keyword, 2=Gemini classifier, 3=semantic/embedding classifier
    # (crisis/semantic.py — a trained model can replace it later), 4=human review
    layer: Mapped[int] = mapped_column(Integer, nullable=False)

    # JSONB list of {keyword, category, language} from Layer 1, or {confidence, reasoning} from Layer 2.
    matches: Mapped[list[dict] | None] = mapped_column(JSONB, nullable=True)

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
