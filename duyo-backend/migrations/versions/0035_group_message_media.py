"""Voice and video notes on group messages.

A note is stored as three nullable columns on the existing row rather than as
a separate table: it is still one message in one room, with one moderation
verdict and one place in the sequence. Splitting it would mean two rows that
can disagree about whether a thing was delivered.

`body` keeps its NOT NULL: for a note it holds the TRANSCRIPT, which is what
the text screen actually judged. That is deliberate — the moderation decision
stays auditable, and a child who cannot play the clip can still read it.

Revision ID: 0035_group_message_media
Revises: 0034_group_messages
"""

import sqlalchemy as sa
from alembic import op

revision: str = "0035_group_message_media"
down_revision: str | None = "0034_group_messages"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.add_column(
        "group_messages",
        # The object-storage key, not a URL: the bucket is private and the API
        # serves it, so moving buckets must not rewrite what a room said.
        sa.Column("media_key", sa.String(120), nullable=True),
    )
    op.add_column(
        "group_messages",
        # "audio" | "video". A plain string, not an enum — this is a
        # presentation hint, and a third kind should not need a type migration.
        sa.Column("media_kind", sa.String(16), nullable=True),
    )
    op.add_column(
        "group_messages",
        sa.Column("media_duration_ms", sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("group_messages", "media_duration_ms")
    op.drop_column("group_messages", "media_kind")
    op.drop_column("group_messages", "media_key")
