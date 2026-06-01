"""payments: one-time Click/Payme checkout + transaction lifecycle

Revision ID: 0010_payments
Revises: 0009_campaigns
Create Date: 2026-06-01
"""

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0010_payments"
down_revision: Union[str, None] = "0009_campaigns"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_UUID = postgresql.UUID(as_uuid=True)
_NOW = sa.func.now()


def upgrade() -> None:
    provider = postgresql.ENUM("payme", "click", name="payment_provider", create_type=False)
    state = postgresql.ENUM("pending", "paid", "cancelled", name="payment_state", create_type=False)
    for e in (provider, state):
        e.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "payments",
        sa.Column("id", _UUID, primary_key=True),
        sa.Column("user_id", _UUID, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("provider", provider, nullable=False),
        sa.Column("tier", sa.String(20), nullable=False),
        sa.Column("period", sa.String(10), nullable=False),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column("state", state, nullable=False, server_default="pending"),
        sa.Column("provider_trans_id", sa.String(64), nullable=True),
        sa.Column("create_time", sa.BigInteger(), nullable=True),
        sa.Column("perform_time", sa.BigInteger(), nullable=True),
        sa.Column("cancel_time", sa.BigInteger(), nullable=True),
        sa.Column("cancel_reason", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=_NOW, nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=_NOW, nullable=False),
    )
    op.create_index("ix_payments_user_id", "payments", ["user_id"])
    op.create_index("ix_payments_provider_trans_id", "payments", ["provider_trans_id"])


def downgrade() -> None:
    op.drop_index("ix_payments_provider_trans_id", table_name="payments")
    op.drop_index("ix_payments_user_id", table_name="payments")
    op.drop_table("payments")
    for name in ("payment_provider", "payment_state"):
        postgresql.ENUM(name=name).drop(op.get_bind(), checkfirst=True)
