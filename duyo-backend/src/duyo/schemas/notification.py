"""Notification (child-facing) request/response schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class NotificationItem(BaseModel):
    id: UUID
    channel: str
    title: str
    body: str
    sent_at: datetime | None
    read: bool


class UnreadCount(BaseModel):
    count: int
