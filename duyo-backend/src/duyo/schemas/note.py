"""Child note schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class NoteCreate(BaseModel):
    child_id: UUID
    title: str = Field(min_length=1, max_length=120)
    body: str = Field(default="", max_length=20_000)


class NoteUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=120)
    body: str | None = Field(default=None, max_length=20_000)


class NoteRead(BaseModel):
    id: UUID
    title: str
    body: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class NoteListItem(BaseModel):
    """List view — body is omitted so a long note doesn't bloat the list."""

    id: UUID
    title: str
    updated_at: datetime

    model_config = {"from_attributes": True}


class GraphNodeRead(BaseModel):
    id: UUID | None
    title: str
    links: int
    exists: bool


class GraphEdgeRead(BaseModel):
    source: str
    target: str


class GraphRead(BaseModel):
    nodes: list[GraphNodeRead]
    edges: list[GraphEdgeRead]
