"""Review columns on peer_messages, so the safety queue can be worked.

Blocked peer messages were already being persisted with a `moderation_reason`
whose comment said "kept for the safety queue" — but no queue existed, and a
message a filter stopped was simply never seen by anyone. These two columns
are what let a reviewer mark one handled and the next reviewer see only what
is still outstanding.

Mirrors `crisis_events.reviewed_at` / `reviewed_by` exactly, including the
index: the queue's default view is "unreviewed, newest first".

Revision ID: 0027_peer_message_review
Revises: 0026_chat_history_projects
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision: str = "0027_peer_message_review"
down_revision: str | None = "0026_chat_history_projects"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.add_column(
        "peer_messages",
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "peer_messages",
        sa.Column("reviewed_by", sa.String(length=255), nullable=True),
    )
    # Partial index: the queue only ever scans the unreviewed tail, and the
    # reviewed rows accumulate forever. Indexing all of them would grow without
    # bound to serve a query that never reads them.
    op.create_index(
        "ix_peer_messages_unreviewed",
        "peer_messages",
        ["created_at"],
        unique=False,
        postgresql_where=sa.text("reviewed_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index("ix_peer_messages_unreviewed", table_name="peer_messages")
    op.drop_column("peer_messages", "reviewed_by")
    op.drop_column("peer_messages", "reviewed_at")
