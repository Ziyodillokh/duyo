"""SQLAlchemy model for psychology_chunks table (pgvector RAG store).

Mirrors `models/textbook_chunk.py`'s shape/approach, but the source content
is a small hand-authored knowledge base (see `psychology/taxonomy.py`)
instead of parsed textbook PDFs — there is no classifier provenance to track.
"""

from __future__ import annotations

from pgvector.sqlalchemy import Vector
from sqlalchemy import String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from duyo.models.base import UUIDPK, Base, TimestampMixin

EMBEDDING_DIM = 768  # matches gemini-embedding-001 MRL-truncated output


class PsychologyChunk(UUIDPK, TimestampMixin, Base):
    """One knowledge-card entry, ready for vector retrieval."""

    __tablename__ = "psychology_chunks"
    __table_args__ = (
        UniqueConstraint("topic_id", "language", name="uq_psych_topic_language"),
    )

    # ── Traceability / metadata ─────────────────────────────────────────────
    topic_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    # Which age segment this card is written for; NULL = applies to all ages.
    age_segment: Mapped[str | None] = mapped_column(String(20), nullable=True, index=True)
    language: Mapped[str] = mapped_column(String(10), nullable=False, default="uz")

    # ── Content ───────────────────────────────────────────────────────────
    text: Mapped[str] = mapped_column(Text, nullable=False)

    # ── Embedding (nullable until embed step runs) ────────────────────────
    embedding: Mapped[list[float] | None] = mapped_column(
        Vector(EMBEDDING_DIM), nullable=True
    )
