"""psychology_chunks: psychology knowledge-base table with pgvector embedding

Revision ID: 0014_psychology_chunks
Revises: 0013_content_media
Create Date: 2026-07-31
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0014_psychology_chunks"
down_revision: str | None = "0013_content_media"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

EMBEDDING_DIM = 768


def upgrade() -> None:
    # pgvector extension already created by 0002_textbook_chunks — idempotent.
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        "psychology_chunks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),

        sa.Column("topic_id", sa.String(100), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("age_segment", sa.String(20), nullable=True),
        sa.Column("language", sa.String(10), nullable=False, server_default="uz"),

        sa.Column("text", sa.Text, nullable=False),

        sa.Column(
            "embedding",
            sa.Text,  # placeholder; real type set via raw DDL below
            nullable=True,
        ),

        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),

        sa.UniqueConstraint("topic_id", "language", name="uq_psych_topic_language"),
    )

    op.execute(f"ALTER TABLE psychology_chunks ALTER COLUMN embedding TYPE vector({EMBEDDING_DIM}) USING NULL")

    op.create_index("ix_psych_topic_id", "psychology_chunks", ["topic_id"])
    op.create_index("ix_psych_age_segment", "psychology_chunks", ["age_segment"])

    # Small corpus (dozens of hand-authored cards, not thousands of textbook
    # chunks) — IVFFlat's default lists=1 is fine at this scale; revisit if
    # the taxonomy grows into the hundreds (see textbook/store.py's note on
    # ivfflat.probes for the tuning knob this would need).
    op.execute(
        "CREATE INDEX ix_psych_embedding_ivfflat "
        "ON psychology_chunks USING ivfflat (embedding vector_cosine_ops) "
        "WITH (lists = 1)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_psych_embedding_ivfflat")
    op.drop_index("ix_psych_age_segment", "psychology_chunks")
    op.drop_index("ix_psych_topic_id", "psychology_chunks")
    op.drop_table("psychology_chunks")
