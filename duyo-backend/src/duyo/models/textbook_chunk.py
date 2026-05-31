"""SQLAlchemy model for textbook_chunks table (pgvector RAG store)."""

from __future__ import annotations

from pgvector.sqlalchemy import Vector
from sqlalchemy import Boolean, Float, SmallInteger, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from duyo.models.base import UUIDPK, Base, TimestampMixin

EMBEDDING_DIM = 768  # Gemini text-embedding-004


class TextbookChunk(UUIDPK, TimestampMixin, Base):
    """One classified chunk of a textbook, ready for vector retrieval."""

    __tablename__ = "textbook_chunks"
    __table_args__ = (
        UniqueConstraint("doc_id", "chunk_index", name="uq_chunk_doc_index"),
    )

    # ── Traceability ──────────────────────────────────────────────────────
    doc_id: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    chunk_index: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    source_path: Mapped[str] = mapped_column(Text, nullable=False)

    # ── Document-level metadata ───────────────────────────────────────────
    subject: Mapped[str] = mapped_column(String(100), nullable=False)
    grade: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    language: Mapped[str] = mapped_column(String(10), nullable=False, default="uz")
    script: Mapped[str] = mapped_column(String(20), nullable=False, default="latin")

    # ── Chunk-level metadata ──────────────────────────────────────────────
    chapter: Mapped[str | None] = mapped_column(Text, nullable=True)
    topic: Mapped[str | None] = mapped_column(Text, nullable=True)
    topic_id: Mapped[str | None] = mapped_column(String(200), nullable=True, index=True)
    subtopic: Mapped[str | None] = mapped_column(Text, nullable=True)
    content_type: Mapped[str] = mapped_column(String(50), nullable=False, default="explanation")
    difficulty: Mapped[str] = mapped_column(String(20), nullable=False, default="unknown")
    has_formula: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    has_table: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    has_image: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # ── Classifier provenance ─────────────────────────────────────────────
    classified_by: Mapped[str] = mapped_column(String(20), nullable=False, default="rule")
    needs_review: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, index=True)
    confidence_content_type: Mapped[float | None] = mapped_column(Float, nullable=True)
    confidence_topic: Mapped[float | None] = mapped_column(Float, nullable=True)
    confidence_difficulty: Mapped[float | None] = mapped_column(Float, nullable=True)

    # ── Content ───────────────────────────────────────────────────────────
    text: Mapped[str] = mapped_column(Text, nullable=False)

    # ── Embedding (nullable until embed step runs) ────────────────────────
    embedding: Mapped[list[float] | None] = mapped_column(
        Vector(EMBEDDING_DIM), nullable=True
    )
