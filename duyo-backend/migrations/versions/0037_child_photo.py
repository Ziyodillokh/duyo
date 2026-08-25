"""A child's own profile photo.

An object key, not the image and not a URL. Uploads live in the media bucket
the way every other upload does (core/storage.py), so the bucket can move
without rewriting rows, and nothing about the photo is derivable from the
column but the file it points at.

NULL means "no photo", which is what every existing row already is — no
default, no backfill. 120 chars is well over what `uuid4().hex + extension`
produces and leaves room for a prefix if uploads are ever foldered.

Revision ID: 0037_child_photo
Revises: 0036_project_pinned
"""

import sqlalchemy as sa
from alembic import op

revision: str = "0037_child_photo"
down_revision: str | None = "0036_project_pinned"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.add_column(
        "child_profiles",
        sa.Column("photo_key", sa.String(length=120), nullable=True),
    )


def downgrade() -> None:
    # The objects themselves are left in the bucket. Dropping a column is not
    # a reason to destroy a child's uploads, and a re-upgrade would otherwise
    # find every profile blank with the files orphaned and unreachable.
    op.drop_column("child_profiles", "photo_key")
