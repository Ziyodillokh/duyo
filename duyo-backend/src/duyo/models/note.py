"""ChildNote — a note the child writes, linked to other notes by [[title]].

The child's own knowledge graph: notes are the nodes, the [[wiki links]] inside
them are the edges. Links resolve by TITLE within that child's own notes, so a
link to a note that doesn't exist yet is not an error — it shows as an unwritten
node, the way Obsidian shows an unresolved link. That is what makes the graph
grow ahead of the writing.

Titles are unique per child so a link can resolve to exactly one note.
"""

from enum import Enum
from uuid import UUID

from sqlalchemy import ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import ENUM
from sqlalchemy.orm import Mapped, mapped_column

from duyo.models.base import UUIDPK, Base, TimestampMixin


class NoteSource(str, Enum):
    """Who wrote the note.

    `manual` is the child's own hand. `goal_path` is a step DUYO generated
    when it decomposed one of the child's goals into a path (see
    services/goal_paths.py) — kept apart so the app can colour the goal
    cluster distinctly and so re-running decomposition can find its own notes
    instead of duplicating them. `chat_topic` is a knowledge note DUYO grows
    from conversation (services/topic_notes.py) — the ONLY kind DUYO is
    allowed to edit later: a child's own writing is never touched, so "the
    child reads back exactly what they wrote" stays true for manual notes.
    """

    MANUAL = "manual"
    GOAL_PATH = "goal_path"
    CHAT_TOPIC = "chat_topic"


_note_source_enum = ENUM(
    NoteSource,
    name="note_source",
    create_type=False,
    values_callable=lambda enum_cls: [e.value for e in enum_cls],
)


class ChildNote(Base, UUIDPK, TimestampMixin):
    __tablename__ = "child_notes"
    # In Postgres this is actually a unique index on (child_id, lower(title))
    # — migration 0033 — because links and topic-capture resolve titles
    # case-insensitively. The exact-match declaration here only shapes the
    # SQLite tables tests build with create_all.
    __table_args__ = (
        UniqueConstraint("child_id", "title", name="uq_note_child_title"),
    )

    child_id: Mapped[UUID] = mapped_column(
        ForeignKey("child_profiles.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False, default="")
    # Child-chosen hex colour ("#60A5FA"), used by the graph view ONLY as a
    # fallback for a note with no #tag. A tagged note is always coloured by
    # its tag (see mobile lib/galaxy-layout.ts colourOf) — a tag is a
    # category shared by many notes, and letting a per-note colour override
    # it would make the tag legend lie. Null means "use the untagged grey".
    colour: Mapped[str | None] = mapped_column(String(7), nullable=True)
    source: Mapped[NoteSource] = mapped_column(
        _note_source_enum, nullable=False, default=NoteSource.MANUAL,
    )
    # Set only on goal_path notes: which goal DUYO decomposed to produce this
    # step. SET NULL rather than CASCADE so deleting a goal leaves the child's
    # map intact — the steps stop being "a goal's steps" but the child's own
    # graph is theirs to keep.
    goal_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("child_goals.id", ondelete="SET NULL"), nullable=True, index=True,
    )

    def __repr__(self) -> str:
        return f"<ChildNote {self.title!r}>"
