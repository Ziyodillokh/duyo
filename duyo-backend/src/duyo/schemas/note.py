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
    # Parsed from the body on read — never stored, so they can't drift out of
    # sync with the text the child sees.
    tags: list[str] = []

    model_config = {"from_attributes": True}


class NoteListItem(BaseModel):
    """List view — body is omitted so a long note doesn't bloat the list."""

    id: UUID
    title: str
    updated_at: datetime

    model_config = {"from_attributes": True}


class NoteSearchHit(NoteListItem):
    """A match, with the surrounding words so the child can see why it matched."""

    excerpt: str = ""


class BacklinkItem(BaseModel):
    """A note that links here."""

    id: UUID
    title: str


class GraphNodeRead(BaseModel):
    id: UUID | None
    title: str
    links: int
    exists: bool
    # "note" | "unwritten" | "tag" — the view colours by this.
    kind: str = "note"


class GraphEdgeRead(BaseModel):
    source: str
    target: str
    # "link" | "tag" | "mention" — the view draws a mention fainter.
    kind: str = "link"


class GraphRead(BaseModel):
    nodes: list[GraphNodeRead]
    edges: list[GraphEdgeRead]
