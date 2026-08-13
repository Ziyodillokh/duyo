"""Chat history and projects.

Messages were always persisted; nothing exposed them. This adds the two
columns that turn the conversations table into a browsable history — a title
and an optional project — plus the projects table itself.

Both columns are nullable and the table is new, so this is additive: every
existing conversation keeps working untouched, and untitled ones simply fall
back to a first-message preview in the API.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision: str = "0026_chat_history_projects"
down_revision: str | None = "0025_backfill_goal_match_keys"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "projects",
        sa.Column(
            "id", sa.UUID(), primary_key=True, server_default=sa.text("gen_random_uuid()")
        ),
        sa.Column(
            "child_id",
            sa.UUID(),
            sa.ForeignKey("child_profiles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(60), nullable=False),
        sa.Column("instructions", sa.Text(), nullable=True),
        sa.Column("colour", sa.String(9), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_projects_child_id", "projects", ["child_id"])
    op.create_index("ix_projects_child_created", "projects", ["child_id", "created_at"])

    op.add_column("conversations", sa.Column("title", sa.String(80), nullable=True))
    op.add_column("conversations", sa.Column("project_id", sa.UUID(), nullable=True))
    op.create_foreign_key(
        "fk_conversations_project",
        "conversations",
        "projects",
        ["project_id"],
        ["id"],
        # SET NULL, never CASCADE: deleting a folder must not delete the
        # child's conversations, only ungroup them.
        ondelete="SET NULL",
    )
    op.create_index("ix_conversations_project_id", "conversations", ["project_id"])
    # The history list's one hot query: this child's conversations, most
    # recent activity first.
    op.create_index(
        "ix_conversations_child_updated", "conversations", ["child_id", "updated_at"]
    )


def downgrade() -> None:
    op.drop_index("ix_conversations_child_updated", table_name="conversations")
    op.drop_index("ix_conversations_project_id", table_name="conversations")
    op.drop_constraint("fk_conversations_project", "conversations", type_="foreignkey")
    op.drop_column("conversations", "project_id")
    op.drop_column("conversations", "title")
    op.drop_index("ix_projects_child_created", table_name="projects")
    op.drop_index("ix_projects_child_id", table_name="projects")
    op.drop_table("projects")
