"""crisis_events: admin triage fields (reviewed_at, reviewed_by)

Revision ID: 0011_crisis_review
Revises: 0010_payments
Create Date: 2026-06-01
"""

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0011_crisis_review"
down_revision: Union[str, None] = "0010_payments"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("crisis_events", sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("crisis_events", sa.Column("reviewed_by", sa.String(255), nullable=True))


def downgrade() -> None:
    op.drop_column("crisis_events", "reviewed_by")
    op.drop_column("crisis_events", "reviewed_at")
