"""child_style_profiles: evidence-based "how to talk to this child" memory

Companion to child_goals (0016): that table remembers WHAT a child is working
toward, this one remembers WHO they seem to be as a conversation partner
(reply length, humor, encouragement needs, recurring interests/avoided
topics). One row per child, updated in place by services/style_profile.py —
every field is a vote counter, never overwritten by a single message, so one
off day cannot repaint the whole relationship. See models/child_style.py for
the full rationale, including why this is deliberately NOT a clinical/
personality label.

Revision ID: 0023_child_style_profile
Revises: 0022_seed_goal_catalog
Create Date: 2026-08-09
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0023_child_style_profile"
down_revision: str | None = "0022_seed_goal_catalog"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "child_style_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("child_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("child_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("length_votes", postgresql.JSONB, nullable=False,
                  server_default=sa.text("'{}'::jsonb")),
        sa.Column("humor_votes", postgresql.JSONB, nullable=False,
                  server_default=sa.text("'{}'::jsonb")),
        sa.Column("encouragement_votes", postgresql.JSONB, nullable=False,
                  server_default=sa.text("'{}'::jsonb")),
        sa.Column("interests", postgresql.JSONB, nullable=False,
                  server_default=sa.text("'{}'::jsonb")),
        sa.Column("avoid_topics", postgresql.JSONB, nullable=False,
                  server_default=sa.text("'{}'::jsonb")),
        sa.Column("evidence_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        # One evolving profile per child — merges land on this row, they never
        # append a new one (contrast child_goal_events, which is append-only).
        sa.UniqueConstraint("child_id", name="uq_child_style_profiles_child_id"),
    )
    op.create_index("ix_child_style_profiles_child_id", "child_style_profiles", ["child_id"])


def downgrade() -> None:
    op.drop_index("ix_child_style_profiles_child_id", "child_style_profiles")
    op.drop_table("child_style_profiles")
