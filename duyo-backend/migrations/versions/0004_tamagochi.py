"""tamagochi: per-child DUYO state metrics (energy/joy/learning/health)

Concept §4 — the "product DNA". Four 0-100 metrics that decay over time and
are restored by interaction. DUYO never dies (Concept §4.2): metrics clamp at
0, never below.

Revision ID: 0004_tamagochi
Revises: 0003_gamification
Create Date: 2026-06-01
"""

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0004_tamagochi"
down_revision: Union[str, None] = "0003_gamification"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_UUID = postgresql.UUID(as_uuid=True)
_NOW = sa.func.now()


def upgrade() -> None:
    op.create_table(
        "tamagochi_states",
        sa.Column("id", _UUID, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column(
            "child_id", _UUID,
            sa.ForeignKey("child_profiles.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column("energy", sa.SmallInteger, nullable=False, server_default="100"),
        sa.Column("joy", sa.SmallInteger, nullable=False, server_default="100"),
        sa.Column("learning", sa.SmallInteger, nullable=False, server_default="100"),
        sa.Column("health", sa.SmallInteger, nullable=False, server_default="100"),
        # When the metrics were last recomputed/decayed — drives lazy decay.
        sa.Column("last_decay_at", sa.DateTime(timezone=True), server_default=_NOW, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=_NOW, nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=_NOW, nullable=False),
        sa.CheckConstraint(
            "energy BETWEEN 0 AND 100 AND joy BETWEEN 0 AND 100 "
            "AND learning BETWEEN 0 AND 100 AND health BETWEEN 0 AND 100",
            name="ck_tamagochi_metric_range",
        ),
        sa.UniqueConstraint("child_id", name="uq_tamagochi_child"),
    )


def downgrade() -> None:
    op.drop_table("tamagochi_states")
