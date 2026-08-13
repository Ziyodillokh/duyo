"""Conversation — a session of messages between a child and DUYO.

Every message has always been stored here; what was missing was any way to
look back at them. `title` and `project_id` are what turn a growing pile of
rows into a history a child can actually navigate.
"""

from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from duyo.models.base import UUIDPK, Base, TimestampMixin

#: Fits one line of a history row on a narrow phone.
CONVERSATION_TITLE_MAX = 80


class Conversation(Base, UUIDPK, TimestampMixin):
    __tablename__ = "conversations"
    __table_args__ = (
        # The history list is "this child's conversations, newest activity
        # first" — the one query this table exists to serve quickly.
        Index("ix_conversations_child_updated", "child_id", "updated_at"),
    )

    child_id: Mapped[UUID] = mapped_column(
        ForeignKey("child_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    #: Derived from the child's first message (see services/conversations.py).
    #: Nullable because every conversation created before this existed has no
    #: title, and inventing one for them would mean guessing at old content —
    #: the API falls back to a first-message preview instead.
    title: Mapped[str | None] = mapped_column(
        String(CONVERSATION_TITLE_MAX), nullable=True
    )
    #: SET NULL, never CASCADE: deleting a folder must not delete the child's
    #: conversations, only ungroup them.
    project_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("projects.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    message_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    child: Mapped["ChildProfile"] = relationship(back_populates="conversations")  # noqa: F821
    messages: Mapped[list["Message"]] = relationship(  # noqa: F821
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="Message.created_at",
    )

    def __repr__(self) -> str:
        return f"<Conversation id={self.id} child={self.child_id} msgs={self.message_count}>"
