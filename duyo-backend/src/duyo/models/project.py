"""Project — a folder a child groups related conversations into.

Modelled on what a child actually does with one: "Matematika", "Ilmiy ishim",
"Ingliz tili". A conversation belongs to at most one project, and a project
belongs to exactly one child.

`instructions` is the reason a project is worth more than a folder: notes the
child (or their parent) writes once — "menga 6-sinf darajasida tushuntir",
"javoblarni o'zbekcha yoz" — that then apply to every conversation inside it,
so they do not have to be repeated at the top of each new chat. It rides into
the system prompt exactly like the goal and memory blocks do
(services/personalization.py), which means it is child-authored text entering
a prompt and is sanitised on the way in.

Deleting a project must never delete the child's conversations: the FK is
SET NULL, so removing the folder returns its chats to the ungrouped list.
"""

from uuid import UUID

from sqlalchemy import ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from duyo.models.base import UUIDPK, Base, TimestampMixin

#: Long enough to name a subject or a piece of work, short enough to render on
#: one line in a list.
PROJECT_NAME_MAX = 60
#: A paragraph or two. Anything longer stops being instructions and starts
#: crowding out the conversation itself in the prompt.
PROJECT_INSTRUCTIONS_MAX = 1000


class Project(Base, UUIDPK, TimestampMixin):
    __tablename__ = "projects"
    __table_args__ = (
        Index("ix_projects_child_created", "child_id", "created_at"),
    )

    child_id: Mapped[UUID] = mapped_column(
        ForeignKey("child_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(PROJECT_NAME_MAX), nullable=False)
    #: Optional standing instructions applied to every chat in the project.
    instructions: Mapped[str | None] = mapped_column(Text, nullable=True)
    #: Tint used by the list and the chat header, so a child can tell their
    #: projects apart at a glance. Stored as a hex string chosen by the app
    #: from a fixed palette — never free-typed.
    colour: Mapped[str | None] = mapped_column(String(9), nullable=True)

    def __repr__(self) -> str:
        return f"<Project {self.name!r} child={self.child_id}>"
