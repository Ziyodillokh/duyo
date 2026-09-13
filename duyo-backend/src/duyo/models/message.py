"""Message — one turn in a Conversation (child input or DUYO response)."""

from enum import Enum
from uuid import UUID

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import ENUM
from sqlalchemy.orm import Mapped, mapped_column, relationship

from duyo.models.base import UUIDPK, Base, TimestampMixin
from duyo.models.crisis_event import CrisisLevel, _crisis_level_enum


class MessageRole(str, Enum):
    CHILD = "child"
    ASSISTANT = "assistant"
    SYSTEM = "system"


#: `Message.modality` for a turn that was spoken. The only non-NULL value
#: today. Named once here because the voice endpoint writes it and the free
#: plan's voice ceiling reads it, and a quota keyed on a string literal typed
#: twice is a quota that stops counting the day one of them is edited.
MODALITY_VOICE = "voice"


# See models/child.py — force .value over .name so PG enum (lowercase) matches.
_message_role_enum = ENUM(
    MessageRole,
    name="message_role",
    create_type=False,
    values_callable=lambda enum_cls: [e.value for e in enum_cls],
)


class Message(Base, UUIDPK, TimestampMixin):
    __tablename__ = "messages"

    conversation_id: Mapped[UUID] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role: Mapped[MessageRole] = mapped_column(_message_role_enum, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)

    #: How the turn arrived. NULL means typed — that is every row written
    #: before 0045 and every row the text path writes now. The voice endpoint
    #: stamps VOICE on both sides of a turn, which is what the free plan's
    #: daily voice ceiling counts (billing/limits.py). Not inferred from
    #: `model` being NULL: that is two code paths differing by accident, and a
    #: ceiling resting on an accident breaks quietly.
    modality: Mapped[str | None] = mapped_column(String(16), nullable=True)

    # LLM metadata (assistant messages only — null for child)
    model: Mapped[str | None] = mapped_column(nullable=True)
    latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    tokens_in: Mapped[int | None] = mapped_column(Integer, nullable=True)
    tokens_out: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Crisis detection summary (Layer 1+2 combined). Default GREEN for assistant.
    crisis_level: Mapped[CrisisLevel] = mapped_column(
        _crisis_level_enum,
        nullable=False,
        default=CrisisLevel.GREEN,
    )

    conversation: Mapped["Conversation"] = relationship(back_populates="messages")  # noqa: F821
    crisis_events: Mapped[list["CrisisEvent"]] = relationship(  # noqa: F821
        back_populates="message",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Message id={self.id} role={self.role.value} crisis={self.crisis_level.value}>"
