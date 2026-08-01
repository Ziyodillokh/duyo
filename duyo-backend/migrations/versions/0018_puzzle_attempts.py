"""puzzle_attempts: chalkboard logic-puzzle answers

Revision ID: 0018_puzzle_attempts
Revises: 0017_social_graph
Create Date: 2026-08-01
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0018_puzzle_attempts"
down_revision: str | None = "0017_social_graph"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "puzzle_attempts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("child_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("child_profiles.id", ondelete="CASCADE"), nullable=False),
        # Code key from services/puzzles.py — intentionally not a foreign key,
        # the catalogue lives in code so it can change without a migration.
        sa.Column("puzzle_id", sa.String(60), nullable=False),
        sa.Column("chosen_index", sa.Integer, nullable=False),
        sa.Column("is_correct", sa.Boolean, nullable=False),
        sa.Column("difficulty", sa.Integer, nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("child_id", "puzzle_id", name="uq_puzzle_child_item"),
    )
    op.create_index("ix_puzzle_attempts_child_id", "puzzle_attempts", ["child_id"])


def downgrade() -> None:
    op.drop_index("ix_puzzle_attempts_child_id", "puzzle_attempts")
    op.drop_table("puzzle_attempts")
