"""Message — one turn in a Conversation (child input or DUYO response)."""

from enum import Enum
from uuid import UUID

from sqlalchemy import ForeignKey, Integer, Text
from sqlalchemy.dialects.postgresql import ENUM
from sqlalchemy.orm import Mapped, mapped_column, relationship

from duyo.models.base import UUIDPK, Base, TimestampMixin
from duyo.models.crisis_event import CrisisLevel, _crisis_level_enum


class MessageRole(str, Enum):
    CHILD = "child"
    ASSISTANT = "assistant"
    SYSTEM = "system"


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
