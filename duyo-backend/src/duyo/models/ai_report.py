"""AiMessageReport — a child reporting one of DUYO's OWN replies as harmful.

Deliberately separate from MessageFeedback. A 👎 answers "was that a good
answer"; this answers "did this app say something to a child that it should
never have said". Google Play requires the second mechanism from anything that
declares a generative-AI feature, and a preference signal does not stand in for
it — so the two live in two tables, and the safety one is never diluted by
taste.

Shaped like PeerReport on purpose: `reviewed_at` / `reviewed_by`, null meaning
untriaged, newest-first. One reviewer habit then serves both queues.

The reply is SNAPSHOT into the row, not merely referenced. A child can delete
the conversation a second after reporting it, and a queue entry that reads
"message deleted" is unactionable — the entire point is that a human reads the
words the model produced.
"""

from datetime import datetime
from enum import Enum
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from duyo.models.base import UUIDPK, Base, TimestampMixin


class AiReportReason(str, Enum):
    """The closed set a child picks from.

    Five, and no free-text box. A child who has just been upset by a reply
    should not have to compose a sentence to be heard, and every reason here
    names a category a reviewer can act on rather than a mood.
    """

    HARMFUL = "harmful"          # dangerous, encouraged something unsafe
    SEXUAL = "sexual"
    HATEFUL = "hateful"          # insulting, demeaning, about them or anyone
    SCARY = "scary"              # frightening or disturbing
    OTHER = "other"


class AiMessageReport(Base, UUIDPK, TimestampMixin):
    """One child, one reported reply. Re-reporting updates rather than stacks."""

    __tablename__ = "ai_message_reports"
    __table_args__ = (
        UniqueConstraint("message_id", "child_id", name="uq_ai_report_message_child"),
    )

    #: SET NULL rather than CASCADE, for the same reason PeerReport.group_message_id
    #: is: deleting a conversation must not silently empty the safety queue.
    #: `model_output` below is what survives that, and is what gets read.
    message_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("messages.id", ondelete="SET NULL"), nullable=True, index=True,
    )
    child_id: Mapped[UUID] = mapped_column(
        ForeignKey("child_profiles.id", ondelete="CASCADE"), nullable=False, index=True,
    )

    #: An `AiReportReason` value. Stored as text, validated at the API boundary,
    #: so adding a sixth reason is a deploy and not a Postgres enum migration.
    reason: Mapped[str] = mapped_column(String(40), nullable=False)

    #: DUYO's words, copied at report time. The child's own message is NOT
    #: copied here — the complaint is about the model, and the conversation is
    #: already stored once.
    model_output: Mapped[str] = mapped_column(Text, nullable=False)
    model_name: Mapped[str | None] = mapped_column(String(120), nullable=True)

    reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True,
    )
    reviewed_by: Mapped[str | None] = mapped_column(String(255), nullable=True)

    def __repr__(self) -> str:
        return f"<AiMessageReport msg={self.message_id} reason={self.reason}>"
