"""Chat-related schemas."""

from uuid import UUID

from pydantic import BaseModel, Field

from duyo.models.child import AgeSegment, Language
from duyo.models.crisis_event import CrisisLevel


class ChildCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    age: int = Field(ge=7, le=16)
    language: Language = Language.UZ


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


class ChatResponse(BaseModel):
    conversation_id: UUID
    message_id: UUID
    reply: str
    crisis_level: CrisisLevel
    model: str
    latency_ms: int
