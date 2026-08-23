"""Peer-facing schemas.

`PeerCard` is the ONLY shape ever returned about another child. It carries a
pseudonym and an age band — never `ChildProfile.name`, never an exact age,
never a phone, school or region.
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from duyo.models.child import AgeSegment
from duyo.models.social import FriendshipStatus


class PeerCard(BaseModel):
    child_id: UUID
    display_name: str
    age_segment: AgeSegment


class GoalMateRead(BaseModel):
    peer: PeerCard
    match_key: str
    shared_goal: str


class SocialSettingsRead(BaseModel):
    display_name: str
    discoverable: bool


class SocialSettingsUpdate(BaseModel):
    discoverable: bool | None = None
    # The child's own handle. Validated server-side (see services/social.py):
    # a handle shows on every message, so it needs the same contact-detail
    # screening a message body gets.
    display_name: str | None = Field(default=None, max_length=20)
    regenerate_handle: bool = False


class HandleSuggestions(BaseModel):
    suggestions: list[str]


class FriendRequestCreate(BaseModel):
    peer_child_id: UUID


class FriendshipRead(BaseModel):
    id: UUID
    peer: PeerCard
    status: FriendshipStatus
    # True when the OTHER child sent it — i.e. this side may accept.
    incoming: bool
    match_key: str | None
    created_at: datetime


class PeerMessageRead(BaseModel):
    id: UUID
    seq: int
    body: str
    mine: bool
    created_at: datetime


class PeerMessageCreate(BaseModel):
    body: str = Field(min_length=1, max_length=500)


class GroupRead(BaseModel):
    """One room. `key` is category + age segment; the client never builds it."""

    key: str
    category: str
    label: str
    members: int
    #: True when the caller is in this room. The list also carries rooms they
    #: are not in, so the screen can say what joining would take.
    joined: bool


class GroupMessageRead(BaseModel):
    id: UUID
    seq: int
    #: For a note this is the TRANSCRIPT — what the safety screen actually
    #: judged, and the caption for anyone who cannot play the clip.
    body: str
    sender_name: str
    mine: bool
    created_at: datetime
    #: Absolute URL of the clip, or None for a plain text message.
    media_url: str | None = None
    #: "audio" | "video".
    media_kind: str | None = None
    media_duration_ms: int | None = None


class GroupMessageCreate(BaseModel):
    body: str = Field(min_length=1, max_length=500)


class PeerReportCreate(BaseModel):
    reason: str | None = Field(default=None, max_length=200)
