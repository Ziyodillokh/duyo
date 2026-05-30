"""textbook_chunks: RAG knowledge base table with pgvector embedding

Revision ID: 0002_textbook_chunks
Revises: 0001_initial
Create Date: 2026-05-30
"""

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002_textbook_chunks"
down_revision: Union[str, None] = "0001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Gemini text-embedding-004 produces 768-dimensional vectors.
EMBEDDING_DIM = 768


def upgrade() -> None:
    # Enable pgvector extension (idempotent)
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        "textbook_chunks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),

        # ── Traceability ─────────────────────────────────────────────────
        sa.Column("doc_id", sa.String(16), nullable=False),
        sa.Column("chunk_index", sa.SmallInteger, nullable=False),
        sa.Column("source_path", sa.Text, nullable=False),

        # ── Document-level metadata (from path, never from LLM) ──────────
        sa.Column("subject", sa.String(100), nullable=False),
        sa.Column("grade", sa.SmallInteger, nullable=False),
        sa.Column("language", sa.String(10), nullable=False, server_default="uz"),
        sa.Column("script", sa.String(20), nullable=False, server_default="latin"),

        # ── Chunk-level metadata (from classifier) ───────────────────────
        sa.Column("chapter", sa.Text, nullable=True),
        sa.Column("topic", sa.Text, nullable=True),
        sa.Column("topic_id", sa.String(200), nullable=True),
        sa.Column("subtopic", sa.Text, nullable=True),
        sa.Column("content_type", sa.String(50), nullable=False, server_default="explanation"),
        sa.Column("difficulty", sa.String(20), nullable=False, server_default="unknown"),
        sa.Column("has_formula", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("has_table", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("has_image", sa.Boolean, nullable=False, server_default=sa.false()),

        # ── Classifier provenance ────────────────────────────────────────
        sa.Column("classified_by", sa.String(20), nullable=False, server_default="rule"),
        sa.Column("needs_review", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("confidence_content_type", sa.Float, nullable=True),
        sa.Column("confidence_topic", sa.Float, nullable=True),
        sa.Column("confidence_difficulty", sa.Float, nullable=True),

        # ── Chunk text ────────────────────────────────────────────────────
        sa.Column("text", sa.Text, nullable=False),

        # ── Embedding (nullable — set after classification, before search) ─
        sa.Column(
            "embedding",
            sa.Text,  # placeholder column type; real type set via raw SQL below
            nullable=True,
        ),

        # ── Timestamps ───────────────────────────────────────────────────
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),

        sa.CheckConstraint("grade >= 1 AND grade <= 12", name="ck_chunk_grade_range"),
        sa.UniqueConstraint("doc_id", "chunk_index", name="uq_chunk_doc_index"),
    )

    # Replace TEXT placeholder with the real vector column type.
    # Alembic doesn't know about pgvector, so we use raw DDL.
    op.execute(f"ALTER TABLE textbook_chunks ALTER COLUMN embedding TYPE vector({EMBEDDING_DIM}) USING NULL")

    # ── Indexes ──────────────────────────────────────────────────────────

    # Retrieval filters
    op.create_index("ix_chunks_subject_grade", "textbook_chunks", ["subject", "grade"])
    op.create_index("ix_chunks_topic_id", "textbook_chunks", ["topic_id"])
    op.create_index("ix_chunks_content_type", "textbook_chunks", ["content_type"])
    op.create_index("ix_chunks_needs_review", "textbook_chunks", ["needs_review"],
                    postgresql_where=sa.text("needs_review = TRUE"))
    op.create_index("ix_chunks_doc_id", "textbook_chunks", ["doc_id"])

    # ANN vector index — IVFFlat with cosine distance.
    # Build AFTER bulk insert (run `SET ivfflat.probes = 10` at query time).
    # nlist = 100 is a safe default for up to ~1M vectors.
    op.execute(
        "CREATE INDEX ix_chunks_embedding_ivfflat "
        "ON textbook_chunks USING ivfflat (embedding vector_cosine_ops) "
        "WITH (lists = 100)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_chunks_embedding_ivfflat")
    op.drop_index("ix_chunks_needs_review", "textbook_chunks")
    op.drop_index("ix_chunks_content_type", "textbook_chunks")
    op.drop_index("ix_chunks_topic_id", "textbook_chunks")
    op.drop_index("ix_chunks_subject_grade", "textbook_chunks")
    op.drop_index("ix_chunks_doc_id", "textbook_chunks")
    op.drop_table("textbook_chunks")
    op.execute("DROP EXTENSION IF EXISTS vector")
