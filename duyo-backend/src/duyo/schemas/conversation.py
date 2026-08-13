"""Chat history and project schemas."""

from datetime import datetime
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from duyo.models.conversation import CONVERSATION_TITLE_MAX
from duyo.models.project import PROJECT_INSTRUCTIONS_MAX, PROJECT_NAME_MAX

# A short, fixed palette the app picks from. Not free-typed: an arbitrary
# colour string is unvalidated input rendered straight into a style.
PROJECT_COLOURS = (
    "#60A5FA",  # blue
    "#05DF72",  # green
    "#FDC700",  # yellow
    "#FB64B6",  # pink
    "#A78BFA",  # purple
    "#FB923C",  # orange
)


def _clean(text: str) -> str:
    """Collapse whitespace — a name of spaces is not a name."""
    return " ".join(text.split())


def _validated_name(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = _clean(value)
    if not cleaned:
        raise ValueError("Loyiha nomi bo'sh bo'lmasin")
    return cleaned


def _validated_colour(value: str | None) -> str | None:
    """Only the app's own palette — an arbitrary string here would be
    unvalidated input rendered straight into a style."""
    if value is None:
        return None
    if value not in PROJECT_COLOURS:
        raise ValueError("Noma'lum rang")
    return value


class ProjectCreate(BaseModel):
    name: Annotated[str, Field(min_length=1, max_length=PROJECT_NAME_MAX)]
    instructions: Annotated[str, Field(max_length=PROJECT_INSTRUCTIONS_MAX)] | None = None
    colour: str | None = None

    _check_name = field_validator("name")(_validated_name)
    _check_colour = field_validator("colour")(_validated_colour)


class ProjectUpdate(BaseModel):
    name: Annotated[str, Field(min_length=1, max_length=PROJECT_NAME_MAX)] | None = None
    instructions: Annotated[str, Field(max_length=PROJECT_INSTRUCTIONS_MAX)] | None = None
    colour: str | None = None

    _check_name = field_validator("name")(_validated_name)
    _check_colour = field_validator("colour")(_validated_colour)


class ProjectRead(BaseModel):
    id: UUID
    name: str
    instructions: str | None
    colour: str | None
    #: How many conversations are filed here — the one number the list needs.
    conversation_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ConversationRead(BaseModel):
    """One row of the history list."""

    id: UUID
    #: Falls back to a first-message preview for conversations that predate
    #: titling; never null, so the client never has to invent a label.
    title: str
    project_id: UUID | None
    message_count: int
    #: First line of the most recent message, for the second row of the card.
    preview: str | None
    #: Last activity — what the list is sorted and grouped by.
    updated_at: datetime
    created_at: datetime


class ConversationUpdate(BaseModel):
    """Rename, or move between projects.

    `project_id` uses a sentinel rather than plain None so "remove from the
    project" is distinguishable from "don't change the project": with a plain
    optional field both arrive as None.
    """

    title: Annotated[str, Field(min_length=1, max_length=CONVERSATION_TITLE_MAX)] | None = None
    project_id: UUID | None = None
    #: Set true together with project_id=null to ungroup.
    clear_project: bool = False

    @field_validator("title")
    @classmethod
    def _title_not_blank(cls, v: str | None) -> str | None:
        if v is None:
            return None
        cleaned = _clean(v)
        if not cleaned:
            raise ValueError("Sarlavha bo'sh bo'lmasin")
        return cleaned


class MessageRead(BaseModel):
    id: UUID
    role: str
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}
