"""MessageFeedback — a child's 👍/👎 on one DUYO reply.

This is the SAFE foundation for "DUYO learns from use": nothing here changes
model behaviour automatically. Ratings accumulate as a reviewable dataset that
a human (pedagogue / safety officer, via the admin panel) inspects before any
prompt or fine-tuning decision. An auto-applied feedback loop on a children's
product would let one bad reply propagate to every child — so the loop stays
human-gated by design.

One row per (message, child): re-rating updates the existing row.
"""

from datetime import datetime
from enum import Enum
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import ENUM
from sqlalchemy.orm import Mapped, mapped_column

from duyo.models.base import UUIDPK, Base, TimestampMixin


class FeedbackRating(str, Enum):
    UP = "up"
    DOWN = "down"


# See models/child.py — force .value so the PG enum (lowercase) matches.
_feedback_rating_enum = ENUM(
    FeedbackRating,
    name="feedback_rating",
    create_type=False,
    values_callable=lambda enum_cls: [e.value for e in enum_cls],
)


class MessageFeedback(Base, UUIDPK, TimestampMixin):
    __tablename__ = "message_feedback"
    __table_args__ = (
        UniqueConstraint("message_id", "child_id", name="uq_feedback_message_child"),
    )

    message_id: Mapped[UUID] = mapped_column(
        ForeignKey("messages.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    child_id: Mapped[UUID] = mapped_column(
        ForeignKey("child_profiles.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    rating: Mapped[FeedbackRating] = mapped_column(_feedback_rating_enum, nullable=False)
    # Optional free-text reason, capped short — children rarely type long notes
    # and a long field would invite pasting conversation content back in.
    reason: Mapped[str | None] = mapped_column(String(200), nullable=True)

    # Human review (admin panel). Null = not yet triaged; reviewed_by snapshots
    # the admin email, mirroring crisis_events' triage fields.
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reviewed_by: Mapped[str | None] = mapped_column(String(255), nullable=True)

    def __repr__(self) -> str:
        return f"<MessageFeedback msg={self.message_id} rating={self.rating.value}>"
