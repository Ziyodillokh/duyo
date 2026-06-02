"""content_type enum: add language + dtm (align with app library categories)

Revision ID: 0012_content_types
Revises: 0011_crisis_review
Create Date: 2026-06-02

PG12+ allows ALTER TYPE ... ADD VALUE inside a transaction as long as the new
value isn't used in the same transaction (we only add). IF NOT EXISTS keeps it
idempotent. Enum values can't be dropped in Postgres → downgrade is a no-op.
"""

from collections.abc import Sequence
from typing import Union

from alembic import op

revision: str = "0012_content_types"
down_revision: Union[str, None] = "0011_crisis_review"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE content_type ADD VALUE IF NOT EXISTS 'language'")
    op.execute("ALTER TYPE content_type ADD VALUE IF NOT EXISTS 'dtm'")


def downgrade() -> None:
    # Postgres can't drop enum values; nothing to undo.
    pass
