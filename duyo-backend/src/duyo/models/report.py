"""Report — cached 10-day parent analysis (Concept §11).

Aggregate sections only; conversation text is never stored (privacy §11.3).
"""

from datetime import datetime
from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from duyo.models.base import Base, TimestampMixin, UUIDPK


class Report(Base, UUIDPK, TimestampMixin):
    __tablename__ = "reports"

    child_id: Mapped[UUID] = mapped_column(
        ForeignKey("child_profiles.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    period_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    period_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    sections: Mapped[dict] = mapped_column(JSONB, nullable=False)
    llm_ok: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
