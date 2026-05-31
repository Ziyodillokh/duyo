"""TamagochiState — per-child DUYO well-being metrics (Concept §4).

Four 0-100 metrics that decay over time and are restored by interaction.
DUYO never dies (§4.2): metrics clamp at 0, never below. Decay is applied
lazily on read from `last_decay_at`, so no cron job is required for MVP.
"""

from datetime import datetime
from uuid import UUID

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, SmallInteger, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from duyo.models.base import UUIDPK, Base, TimestampMixin


class TamagochiState(Base, UUIDPK, TimestampMixin):
    __tablename__ = "tamagochi_states"
    __table_args__ = (
        CheckConstraint(
            "energy BETWEEN 0 AND 100 AND joy BETWEEN 0 AND 100 "
            "AND learning BETWEEN 0 AND 100 AND health BETWEEN 0 AND 100",
            name="ck_tamagochi_metric_range",
        ),
        UniqueConstraint("child_id", name="uq_tamagochi_child"),
    )

    child_id: Mapped[UUID] = mapped_column(
        ForeignKey("child_profiles.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    energy: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=100)
    joy: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=100)
    learning: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=100)
    health: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=100)
    last_decay_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
    )
