"""Child note schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

# Opaque 6-hex-digit colour only ("#60A5FA") — matches the app's neon
# palette swatches (tailwind.config.js), not free-form CSS colour syntax.
# "" is also accepted (NoteUpdate only) as an explicit "clear it" value,
# distinct from omitting the field entirely — see NoteUpdate.colour.
_HEX_COLOUR = r"^#[0-9A-Fa-f]{6}$"
_HEX_COLOUR_OR_CLEAR = r"^(#[0-9A-Fa-f]{6})?$"


class NoteCreate(BaseModel):
    child_id: UUID
    title: str = Field(min_length=1, max_length=120)
    body: str = Field(default="", max_length=20_000)
    colour: str | None = Field(default=None, pattern=_HEX_COLOUR)


class NoteUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=120)
    body: str | None = Field(default=None, max_length=20_000)
    # None = "leave colour as it is"; "" = "clear it back to auto"; a hex
    # string = "set it". Unlike title/body there is a real reason to want
    # "clear", so colour alone needs the three-way distinction.
    colour: str | None = Field(default=None, pattern=_HEX_COLOUR_OR_CLEAR)


class NoteRead(BaseModel):
    id: UUID
    title: str
    body: str
    created_at: datetime
    updated_at: datetime
    # Parsed from the body on read — never stored, so they can't drift out of
    # sync with the text the child sees.
    tags: list[str] = []
    colour: str | None = None

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


class UnlinkedMention(BaseModel):
    """A note that names this one in prose but never [[linked]] it."""

    id: UUID
    title: str
    excerpt: str = ""


class LinkMentionRequest(BaseModel):
    """Turn one note's prose mention of another into a real link."""

    source_id: UUID


class TagRename(BaseModel):
    child_id: UUID
    old: str = Field(min_length=1, max_length=40)
    new: str = Field(min_length=1, max_length=40)


class GraphNodeRead(BaseModel):
    id: UUID | None
    title: str
    links: int
    exists: bool
    # "note" | "unwritten" | "tag" — the view colours by this.
    kind: str = "note"
    # The note's own chosen colour. Only meaningful when the note carries no
    # #tag — the view still colours a tagged note by its tag first.
    colour: str | None = None


class GraphEdgeRead(BaseModel):
    source: str
    target: str
    # "link" | "tag" | "mention" — the view draws a mention fainter.
    kind: str = "link"


class GraphRead(BaseModel):
    nodes: list[GraphNodeRead]
    edges: list[GraphEdgeRead]
