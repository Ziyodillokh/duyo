"""notifications: campaigns (admin-composed push/SMS/email broadcasts)

Revision ID: 0009_campaigns
Revises: 7c23d3a783ed
Create Date: 2026-06-01
"""

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0009_campaigns"
down_revision: Union[str, None] = "7c23d3a783ed"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_UUID = postgresql.UUID(as_uuid=True)
_NOW = sa.func.now()


def upgrade() -> None:
    channel = postgresql.ENUM("push", "sms", "email", "in_app", name="campaign_channel", create_type=False)
    statusE = postgresql.ENUM("draft", "scheduled", "sent", "canceled", name="campaign_status", create_type=False)
    for e in (channel, statusE):
        e.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "campaigns",
        sa.Column("id", _UUID, primary_key=True),
        sa.Column("channel", channel, nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("audience", sa.String(40), nullable=False, server_default="all"),
        sa.Column("status", statusE, nullable=False, server_default="draft"),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("sent_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("failed_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=_NOW, nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=_NOW, nullable=False),
    )
    op.create_index("ix_campaigns_status", "campaigns", ["status"])


def downgrade() -> None:
    op.drop_index("ix_campaigns_status", table_name="campaigns")
    op.drop_table("campaigns")
    for name in ("campaign_channel", "campaign_status"):
        postgresql.ENUM(name=name).drop(op.get_bind(), checkfirst=True)
