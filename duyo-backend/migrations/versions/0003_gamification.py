"""gamification: avatars, balls_transactions, inventory_items, streaks

Concept §3 (avatar), §8 (ball/level/streak/inventory).

Revision ID: 0003_gamification
Revises: 0002_textbook_chunks
Create Date: 2026-06-01
"""

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0003_gamification"
down_revision: Union[str, None] = "0002_textbook_chunks"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_UUID = postgresql.UUID(as_uuid=True)
_PK = sa.text("gen_random_uuid()")
_NOW = sa.func.now()


def _child_fk(name: str = "child_id") -> sa.Column:
    return sa.Column(
        name, _UUID,
        sa.ForeignKey("child_profiles.id", ondelete="CASCADE"),
        nullable=False,
    )


def upgrade() -> None:
    # ── avatars: one DUYO appearance config per child ────────────────────────
    op.create_table(
        "avatars",
        sa.Column("id", _UUID, primary_key=True, server_default=_PK),
        _child_fk(),
        sa.Column("body_shape", sa.String(20), nullable=False, server_default="spherical"),
        sa.Column("primary_color", sa.String(7), nullable=False, server_default="#4F8DFD"),
        sa.Column("accent_color", sa.String(7), nullable=False, server_default="#FFD166"),
        sa.Column("face_style", sa.String(20), nullable=False, server_default="friendly"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=_NOW, nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=_NOW, nullable=False),
        sa.UniqueConstraint("child_id", name="uq_avatar_child"),
    )

    # ── balls_transactions: XP earn (+) / spend (-) ledger ───────────────────
    # Balance = SUM(amount); balance_after is the running total at write time
    # (audit + fast latest-balance read without re-summing).
    op.create_table(
        "balls_transactions",
        sa.Column("id", _UUID, primary_key=True, server_default=_PK),
        _child_fk(),
        sa.Column("amount", sa.Integer, nullable=False),
        sa.Column("reason", sa.String(50), nullable=False),
        sa.Column("balance_after", sa.Integer, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=_NOW, nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=_NOW, nullable=False),
    )
    op.create_index("ix_balls_tx_child_id", "balls_transactions", ["child_id"])

    # ── inventory_items: accessories/gadgets a child has acquired ────────────
    op.create_table(
        "inventory_items",
        sa.Column("id", _UUID, primary_key=True, server_default=_PK),
        _child_fk(),
        sa.Column("item_key", sa.String(60), nullable=False),
        sa.Column("category", sa.String(30), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=_NOW, nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=_NOW, nullable=False),
        sa.UniqueConstraint("child_id", "item_key", name="uq_inventory_child_item"),
    )
    op.create_index("ix_inventory_child_id", "inventory_items", ["child_id"])

    # ── streaks: daily-activity tracking, one row per child ──────────────────
    op.create_table(
        "streaks",
        sa.Column("id", _UUID, primary_key=True, server_default=_PK),
        _child_fk(),
        sa.Column("current_streak", sa.Integer, nullable=False, server_default="0"),
        sa.Column("longest_streak", sa.Integer, nullable=False, server_default="0"),
        sa.Column("last_active_date", sa.Date, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=_NOW, nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=_NOW, nullable=False),
        sa.UniqueConstraint("child_id", name="uq_streak_child"),
    )


def downgrade() -> None:
    op.drop_table("streaks")
    op.drop_index("ix_inventory_child_id", table_name="inventory_items")
    op.drop_table("inventory_items")
    op.drop_index("ix_balls_tx_child_id", table_name="balls_transactions")
    op.drop_table("balls_transactions")
    op.drop_table("avatars")
