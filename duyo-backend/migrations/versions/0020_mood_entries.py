"""mood_entries: one self-reported mood per child per day

Revision ID: 0020_mood_entries
Revises: 0019_child_notes
Create Date: 2026-08-02
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0020_mood_entries"
down_revision: str | None = "0019_child_notes"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    mood_value = postgresql.ENUM(
        "great", "good", "okay", "sad", "stressed",
        name="mood_value", create_type=False,
    )
    mood_value.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "mood_entries",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("child_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("child_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("entry_date", sa.Date, nullable=False),
        sa.Column("mood", mood_value, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        # One reading per day — re-tapping updates rather than appending.
        sa.UniqueConstraint("child_id", "entry_date", name="uq_mood_child_date"),
    )
    op.create_index("ix_mood_entries_child_id", "mood_entries", ["child_id"])
    op.create_index("ix_mood_entries_entry_date", "mood_entries", ["entry_date"])


def downgrade() -> None:
    op.drop_index("ix_mood_entries_entry_date", "mood_entries")
    op.drop_index("ix_mood_entries_child_id", "mood_entries")
    op.drop_table("mood_entries")
    sa.Enum(name="mood_value").drop(op.get_bind(), checkfirst=True)
