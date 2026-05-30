"""Request/response schemas for textbook API."""

from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, Field


class ChunkResult(BaseModel):
    """Single search result chunk."""

    text: str
    subject: str
    grade: int
    language: str
    topic: str | None
    topic_id: str | None
    content_type: str
    difficulty: str
    has_formula: bool
    source_path: str
    similarity: float = Field(ge=0.0, le=1.0)


class SearchResponse(BaseModel):
    """Response from GET /v1/textbook/search."""

    query: str
    results: list[ChunkResult]
    total: int


class ReviewChunk(BaseModel):
    """A chunk awaiting human review."""

    id: UUID
    doc_id: str
    chunk_index: int
    text: str
    subject: str
    grade: int
    topic: str | None
    topic_id: str | None
    content_type: str
    difficulty: str
    has_formula: bool
    has_table: bool
    has_image: bool
    classified_by: str
    confidence_content_type: float | None
    source_path: str


class ReviewListResponse(BaseModel):
    """Response from GET /v1/textbook/review."""

    chunks: list[ReviewChunk]
    total: int
    page: int
    page_size: int


class ApprovePayload(BaseModel):
    """Body for PATCH /v1/textbook/chunks/{id}/approve."""

    content_type: str | None = None     # override if reviewer disagrees
    topic: str | None = None
    topic_id: str | None = None
    difficulty: str | None = None


class StatsResponse(BaseModel):
    """Response from GET /v1/textbook/stats."""

    total_chunks: int
    embedded_chunks: int
    pending_review: int
    by_subject: dict[str, int]
    by_content_type: dict[str, int]
