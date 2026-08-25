"""Pinning a project to the top of the list.

A nullable timestamp, not a boolean. "Pinned" and "when it was pinned" are the
same fact, and storing the moment costs nothing while a flag would throw it
away — with several pinned projects the list still has to put them in some
order, and the order a child expects is the one they made.

NULL means unpinned, so every existing row is already correct and the column
needs no default and no backfill.

Revision ID: 0036_project_pinned
Revises: 0035_group_message_media
"""

import sqlalchemy as sa
from alembic import op

revision: str = "0036_project_pinned"
down_revision: str | None = "0035_group_message_media"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.add_column(
        "projects",
        sa.Column("pinned_at", sa.DateTime(timezone=True), nullable=True),
    )
    # The list reads "pinned first, newest first" on every open, and a child
    # with forty projects should not make Postgres sort them each time.
    op.create_index(
        "ix_projects_child_pinned",
        "projects",
        ["child_id", "pinned_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_projects_child_pinned", table_name="projects")
    op.drop_column("projects", "pinned_at")
