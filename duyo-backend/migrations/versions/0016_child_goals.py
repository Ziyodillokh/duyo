"""child goals: cross-conversation memory of what a child is working toward

Revision ID: 0016_child_goals
Revises: 0015_message_feedback
Create Date: 2026-08-01
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0016_child_goals"
down_revision: str | None = "0015_message_feedback"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    goal_kind = postgresql.ENUM(
        "book", "textbook", "skill", "exam", "habit", "other",
        name="goal_kind", create_type=False,
    )
    goal_status = postgresql.ENUM(
        "active", "completed", "paused", "abandoned",
        name="goal_status", create_type=False,
    )
    goal_source = postgresql.ENUM(
        "child_stated", "parent_set", "onboarding", "inferred",
        name="goal_source", create_type=False,
    )
    for enum in (goal_kind, goal_status, goal_source):
        enum.create(op.get_bind(), checkfirst=True)

    # ---- goal_catalog: the curated list; `matchable` is the publish gate ----
    op.create_table(
        "goal_catalog",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("match_key", sa.String(80), nullable=False),
        sa.Column("kind", goal_kind, nullable=False),
        sa.Column("title", sa.String(160), nullable=False),
        sa.Column("target_ref", postgresql.JSONB, nullable=True),
        sa.Column("age_min", sa.Integer, nullable=False, server_default="7"),
        sa.Column("age_max", sa.Integer, nullable=False, server_default="16"),
        sa.Column("active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("matchable", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reviewed_by", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("match_key", name="uq_goal_catalog_match_key"),
    )

    # ---- child_goals ----
    op.create_table(
        "child_goals",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("child_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("child_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kind", goal_kind, nullable=False),
        sa.Column("title", sa.String(160), nullable=False),
        sa.Column("target_ref", postgresql.JSONB, nullable=True),
        # SET NULL: retiring a catalogue entry makes the goal undiscoverable,
        # it must never delete the child's goal.
        sa.Column("match_key", sa.String(80),
                  sa.ForeignKey("goal_catalog.match_key", ondelete="SET NULL"),
                  nullable=True),
        sa.Column("status", goal_status, nullable=False, server_default="active"),
        sa.Column("source", goal_source, nullable=False),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("unit_label", sa.String(24), nullable=True),
        sa.Column("current_unit", sa.Integer, nullable=True),
        sa.Column("total_units", sa.Integer, nullable=True),
        sa.Column("progress_pct", sa.Float, nullable=True),
        sa.Column("last_progress_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("target_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_child_goals_child_id", "child_goals", ["child_id"])
    op.create_index("ix_child_goals_match_key", "child_goals", ["match_key"])
    op.create_index("ix_child_goals_child_status", "child_goals", ["child_id", "status"])
    # Partial: one ACTIVE goal per catalogue entry per child, but the same book
    # may be picked up again years later once the first attempt is closed.
    op.create_index(
        "uq_child_goal_active_key",
        "child_goals",
        ["child_id", "match_key"],
        unique=True,
        postgresql_where=sa.text("status = 'active' AND match_key IS NOT NULL"),
    )

    # ---- child_goal_events: append-only progress log ----
    op.create_table(
        "child_goal_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("goal_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("child_goals.id", ondelete="CASCADE"), nullable=False),
        sa.Column("child_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("child_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("unit_value", sa.Integer, nullable=True),
        sa.Column("note", sa.Text, nullable=True),
        sa.Column("source", goal_source, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_child_goal_events_goal_id", "child_goal_events", ["goal_id"])
    op.create_index("ix_child_goal_events_child_id", "child_goal_events", ["child_id"])


def downgrade() -> None:
    op.drop_index("ix_child_goal_events_child_id", "child_goal_events")
    op.drop_index("ix_child_goal_events_goal_id", "child_goal_events")
    op.drop_table("child_goal_events")

    op.drop_index("uq_child_goal_active_key", "child_goals")
    op.drop_index("ix_child_goals_child_status", "child_goals")
    op.drop_index("ix_child_goals_match_key", "child_goals")
    op.drop_index("ix_child_goals_child_id", "child_goals")
    op.drop_table("child_goals")

    op.drop_table("goal_catalog")

    for name in ("goal_source", "goal_status", "goal_kind"):
        sa.Enum(name=name).drop(op.get_bind(), checkfirst=True)
