"""content library: poems/stories/lessons/audio (admin-managed)

Publish gate enforced at API layer: published only when license + review APPROVED.

Revision ID: 0008_content
Revises: 0007_admin
Create Date: 2026-06-01
"""

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0008_content"
down_revision: Union[str, None] = "0007_admin"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_UUID = postgresql.UUID(as_uuid=True)
_NOW = sa.func.now()


def upgrade() -> None:
    content_type = postgresql.ENUM("poem", "story", "lesson", "audio", name="content_type", create_type=False)
    review = postgresql.ENUM("draft", "pending", "approved", "rejected", name="content_review_status", create_type=False)
    license_ = postgresql.ENUM("unknown", "pending", "approved", "rejected", name="content_license_status", create_type=False)
    for e in (content_type, review, license_):
        e.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "content_items",
        sa.Column("id", _UUID, primary_key=True),
        sa.Column("type", content_type, nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("body", sa.Text(), nullable=True),
        sa.Column("age_segment", sa.String(20), nullable=False, server_default="all"),
        sa.Column("language", sa.String(5), nullable=False, server_default="uz"),
        sa.Column("audio_url", sa.String(500), nullable=True),
        sa.Column("author", sa.String(120), nullable=True),
        sa.Column("review_status", review, nullable=False, server_default="draft"),
        sa.Column("license_status", license_, nullable=False, server_default="pending"),
        sa.Column("published", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("completions", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("likes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("reports", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=_NOW, nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=_NOW, nullable=False),
    )
    op.create_index("ix_content_items_type", "content_items", ["type"])


def downgrade() -> None:
    op.drop_index("ix_content_items_type", table_name="content_items")
    op.drop_table("content_items")
    for name in ("content_type", "content_review_status", "content_license_status"):
        postgresql.ENUM(name=name).drop(op.get_bind(), checkfirst=True)
