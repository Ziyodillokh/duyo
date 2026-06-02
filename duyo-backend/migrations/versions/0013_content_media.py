"""content_items: image_url + pdf_url; content_type enum add pdf + photo

Revision ID: 0013_content_media
Revises: 0012_content_types
Create Date: 2026-06-02
"""

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0013_content_media"
down_revision: Union[str, None] = "0012_content_types"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("content_items", sa.Column("image_url", sa.String(500), nullable=True))
    op.add_column("content_items", sa.Column("pdf_url", sa.String(500), nullable=True))
    op.execute("ALTER TYPE content_type ADD VALUE IF NOT EXISTS 'pdf'")
    op.execute("ALTER TYPE content_type ADD VALUE IF NOT EXISTS 'photo'")


def downgrade() -> None:
    op.drop_column("content_items", "pdf_url")
    op.drop_column("content_items", "image_url")
    # Postgres can't drop enum values; pdf/photo remain.
