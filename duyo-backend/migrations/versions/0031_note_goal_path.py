"""child_notes.source + goal_id: brain-map steps generated from a goal

When DUYO detects a goal in chat it decomposes it into an ordered path of
steps and writes them into the child's notes graph (services/goal_paths.py).
`source` tells a DUYO-generated step apart from the child's own writing, and
`goal_id` ties a step back to the goal it came from — so re-running
decomposition finds its own notes instead of duplicating them, and the app
can colour the goal cluster distinctly.

Revision ID: 0031_note_goal_path
Revises: 0030_family_invite_consent
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0031_note_goal_path"
down_revision: str | None = "0030_family_invite_consent"
branch_labels: str | None = None
depends_on: str | None = None

_UUID = postgresql.UUID(as_uuid=True)


def upgrade() -> None:
    source = postgresql.ENUM("manual", "goal_path", name="note_source", create_type=False)
    source.create(op.get_bind(), checkfirst=True)

    op.add_column(
        "child_notes",
        sa.Column("source", source, nullable=False, server_default="manual"),
    )
    op.add_column(
        "child_notes",
        sa.Column(
            "goal_id", _UUID,
            sa.ForeignKey("child_goals.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("ix_child_notes_goal_id", "child_notes", ["goal_id"])


def downgrade() -> None:
    op.drop_index("ix_child_notes_goal_id", table_name="child_notes")
    op.drop_column("child_notes", "goal_id")
    op.drop_column("child_notes", "source")
    postgresql.ENUM(name="note_source").drop(op.get_bind(), checkfirst=True)
