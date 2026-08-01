"""child_notes: the child's own linked notes (knowledge graph)

Revision ID: 0019_child_notes
Revises: 0018_puzzle_attempts
Create Date: 2026-08-01
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0019_child_notes"
down_revision: str | None = "0018_puzzle_attempts"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "child_notes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("child_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("child_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(120), nullable=False),
        sa.Column("body", sa.Text, nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        # A [[link]] resolves by title, so titles must be unique per child.
        sa.UniqueConstraint("child_id", "title", name="uq_note_child_title"),
    )
    op.create_index("ix_child_notes_child_id", "child_notes", ["child_id"])


def downgrade() -> None:
    op.drop_index("ix_child_notes_child_id", "child_notes")
    op.drop_table("child_notes")
