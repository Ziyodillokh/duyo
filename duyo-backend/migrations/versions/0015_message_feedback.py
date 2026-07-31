"""message_feedback: per-child rating of a DUYO reply (human-gated learning dataset)

Revision ID: 0015_message_feedback
Revises: 0014_psychology_chunks
Create Date: 2026-07-31
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0015_message_feedback"
down_revision: str | None = "0014_psychology_chunks"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    feedback_rating = postgresql.ENUM(
        "up", "down", name="feedback_rating", create_type=False,
    )
    feedback_rating.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "message_feedback",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("message_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("messages.id", ondelete="CASCADE"), nullable=False),
        sa.Column("child_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("child_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("rating", feedback_rating, nullable=False),
        sa.Column("reason", sa.String(200), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reviewed_by", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("message_id", "child_id", name="uq_feedback_message_child"),
    )
    op.create_index("ix_message_feedback_message_id", "message_feedback", ["message_id"])
    op.create_index("ix_message_feedback_child_id", "message_feedback", ["child_id"])
    # Admin triage queue: open (unreviewed) items, newest first.
    op.create_index("ix_message_feedback_reviewed_at", "message_feedback", ["reviewed_at"])


def downgrade() -> None:
    op.drop_index("ix_message_feedback_reviewed_at", "message_feedback")
    op.drop_index("ix_message_feedback_child_id", "message_feedback")
    op.drop_index("ix_message_feedback_message_id", "message_feedback")
    op.drop_table("message_feedback")
    sa.Enum(name="feedback_rating").drop(op.get_bind(), checkfirst=True)
