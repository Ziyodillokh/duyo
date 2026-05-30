"""Request/response schemas for textbook search API."""

from __future__ import annotations

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
