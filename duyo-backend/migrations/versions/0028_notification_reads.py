"""notification_reads: per-child read state on sent campaigns

A Campaign row is shared by every recipient, so "has this child seen it"
can't live on the campaign itself — this join table is the per-child mark.
Absence of a row means unread; presence means read (idempotent upsert target).

Revision ID: 0028_notification_reads
Revises: 0027_peer_message_review
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0028_notification_reads"
down_revision: str | None = "0027_peer_message_review"
branch_labels: str | None = None
depends_on: str | None = None

_UUID = postgresql.UUID(as_uuid=True)
_NOW = sa.func.now()


def upgrade() -> None:
    op.create_table(
        "notification_reads",
        sa.Column("id", _UUID, primary_key=True),
        sa.Column(
            "child_id", _UUID,
            sa.ForeignKey("child_profiles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "campaign_id", _UUID,
            sa.ForeignKey("campaigns.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("read_at", sa.DateTime(timezone=True), server_default=_NOW, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=_NOW, nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=_NOW, nullable=False),
        sa.UniqueConstraint("child_id", "campaign_id", name="uq_notification_read_child_campaign"),
    )
    op.create_index("ix_notification_reads_child_id", "notification_reads", ["child_id"])
    op.create_index("ix_notification_reads_campaign_id", "notification_reads", ["campaign_id"])


def downgrade() -> None:
    op.drop_index("ix_notification_reads_campaign_id", table_name="notification_reads")
    op.drop_index("ix_notification_reads_child_id", table_name="notification_reads")
    op.drop_table("notification_reads")
