"""ChildNote — a note the child writes, linked to other notes by [[title]].

The child's own knowledge graph: notes are the nodes, the [[wiki links]] inside
them are the edges. Links resolve by TITLE within that child's own notes, so a
link to a note that doesn't exist yet is not an error — it shows as an unwritten
node, the way Obsidian shows an unresolved link. That is what makes the graph
grow ahead of the writing.

Titles are unique per child so a link can resolve to exactly one note.
"""

from uuid import UUID

from sqlalchemy import ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from duyo.models.base import UUIDPK, Base, TimestampMixin


class ChildNote(Base, UUIDPK, TimestampMixin):
    __tablename__ = "child_notes"
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

    def __repr__(self) -> str:
        return f"<ChildNote {self.title!r}>"
