"""Metadata schema for textbook chunks.

ContentType enum: 7 types sufficient for DUYO's K-9 curriculum.
blooms_level and quality_notes are Phase 2 additions.
"""

from __future__ import annotations

from enum import StrEnum
from typing import Annotated

from pydantic import BaseModel, Field


class ContentType(StrEnum):
    DEFINITION = "definition"       # "Ta'rif:", "deb ataladi"
    RULE = "rule"                    # "Qoida:", formula rule
    EXPLANATION = "explanation"      # Concept explanation, narrative
    EXAMPLE = "example"             # "Masalan:", worked demo (non-step)
    WORKED_SOLUTION = "worked_solution"  # Step-by-step yechim
    EXERCISE = "exercise"           # "Hisoblang:", "Toping:", tasks
    QUIZ = "quiz"                   # A/B/C/D variant questions


class Difficulty(StrEnum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"
    UNKNOWN = "unknown"


class Script(StrEnum):
    LATIN = "latin"
    CYRILLIC = "cyrillic"
    MIXED = "mixed"


class Language(StrEnum):
    UZ = "uz"
    RU = "ru"
    EN = "en"


class Confidence(BaseModel):
    content_type: Annotated[float, Field(ge=0.0, le=1.0)]
    topic: Annotated[float, Field(ge=0.0, le=1.0)]
    difficulty: Annotated[float, Field(ge=0.0, le=1.0)]


class DocumentMeta(BaseModel):
    """Document-level metadata extracted from file path or overrides.

    These fields apply to all chunks from the same source document
    and are never inferred by the LLM classifier.
    """

    subject: str  # "matematika", "ona-tili", "tarix"
    grade: Annotated[int, Field(ge=1, le=12)]
    language: Language = Language.UZ
    script: Script = Script.LATIN
    source_path: str  # relative path for traceability


class ChunkMetadata(BaseModel):
    """Per-chunk metadata produced by the classifier pipeline."""

    # --- From document (always set before classification) ---
    subject: str
    grade: int
    language: Language
    script: Script
    source_path: str

    # --- Classifier output ---
    chapter: str | None = None
    topic: str | None = None           # canonical human-readable topic
    topic_id: str | None = None        # taxonomy slug, e.g. "math_6_fractions_add"
    subtopic: str | None = None

    content_type: ContentType = ContentType.EXPLANATION
    difficulty: Difficulty = Difficulty.UNKNOWN

    has_formula: bool = False
    has_table: bool = False
    has_image: bool = False

    confidence: Confidence = Field(
        default_factory=lambda: Confidence(content_type=0.0, topic=0.0, difficulty=0.0)
    )

    # --- Classifier provenance ---
    classified_by: str = "rule"  # "rule" | "llm" | "llm+rule"
    needs_review: bool = False


class ClassifiedChunk(BaseModel):
    """A chunk of text paired with its metadata, ready for storage or review."""

    text: str
    metadata: ChunkMetadata
    chunk_index: int
    doc_id: str  # hash or UUID of the source document
