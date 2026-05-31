"""reports: cached 10-day parent analysis reports (Concept §11)

On-demand generation with caching: a report covers a [period_start, period_end]
window per child. The aggregate sections are stored as JSONB. Conversation
TEXT is never stored here (privacy contract §11.3) — only aggregates.

Revision ID: 0006_reports
Revises: 0005_subscriptions
Create Date: 2026-06-01
"""

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0006_reports"
down_revision: Union[str, None] = "0005_subscriptions"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_UUID = postgresql.UUID(as_uuid=True)
_NOW = sa.func.now()


def upgrade() -> None:
    op.create_table(
        "reports",
        sa.Column("id", _UUID, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column(
            "child_id", _UUID,
            sa.ForeignKey("child_profiles.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column("period_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("period_end", sa.DateTime(timezone=True), nullable=False),
        # Aggregated sections (no conversation text — privacy §11.3).
        sa.Column("sections", postgresql.JSONB, nullable=False),
        # Whether the LLM mood/topic pass succeeded (vs metrics-only fallback).
        sa.Column("llm_ok", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=_NOW, nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=_NOW, nullable=False),
    )
    # Fast "latest report for this child" lookup (cache hit check).
    op.create_index(
        "ix_reports_child_created", "reports", ["child_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_reports_child_created", table_name="reports")
    op.drop_table("reports")
