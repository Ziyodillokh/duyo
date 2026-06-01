"""Chat-related schemas."""

from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, Field

from duyo.models.child import AgeSegment, Language
from duyo.models.crisis_event import CrisisLevel


class SourceRef(BaseModel):
    title: str
    url: str | None = None


class ChatSource(BaseModel):
    type: Literal["textbook", "web", "none"]
    label: str
    refs: list[SourceRef] = []


class ChatImage(BaseModel):
    url: str                 # display URL (safe to load directly)
    title: str
    source_url: str          # tap-through page for attribution / context
    creator: str | None = None
    license: str | None = None


class QuickReply(BaseModel):
    label: str
    action: Literal["web_search", "dismiss"]
    query: str | None = None


class ChildCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    age: int = Field(ge=7, le=16)
    language: Language = Language.UZ


class ChildUpdate(BaseModel):
    """Partial update — all fields optional. Age change re-derives age_segment.

    Annotated[...] | None is required so the 7-16 bound is enforced on the int
    branch of the union; `int | None = Field(ge=...)` silently drops the
    constraint in pydantic 2.12.
    """

    name: Annotated[str, Field(min_length=1, max_length=80)] | None = None
    age: Annotated[int, Field(ge=7, le=16)] | None = None
    language: Language | None = None


class ChildRead(BaseModel):
    id: UUID
    name: str
    age: int
    age_segment: AgeSegment
    language: Language

    model_config = {"from_attributes": True}


class ChatRequest(BaseModel):
    child_id: UUID
    message: str = Field(min_length=1, max_length=2000)
    conversation_id: UUID | None = None  # null → create new conversation
    action: Literal["web_search"] | None = None
    action_query: str | None = Field(default=None, max_length=2000)


class ChatResponse(BaseModel):
    conversation_id: UUID
    message_id: UUID
    reply: str
    crisis_level: CrisisLevel
    model: str
    latency_ms: int
    source: ChatSource | None = None
    quick_replies: list[QuickReply] = []
    images: list[ChatImage] = []
