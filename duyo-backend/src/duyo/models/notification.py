"""Notification campaigns — admin-composed push/SMS/email broadcasts.

Faza 3: campaign metadata + status lifecycle (draft → scheduled → sent). Actual
delivery (Eskiz SMS / push) is wired later; admin manages campaigns here.
"""

from datetime import datetime
from enum import Enum
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import ENUM
from sqlalchemy.orm import Mapped, mapped_column

from duyo.models.base import UUIDPK, Base, TimestampMixin


class CampaignChannel(str, Enum):
    PUSH = "push"
    SMS = "sms"
    EMAIL = "email"
    IN_APP = "in_app"


class CampaignStatus(str, Enum):
    DRAFT = "draft"
    SCHEDULED = "scheduled"
    SENT = "sent"
    CANCELED = "canceled"


def _enum(enum_cls, name):
    return ENUM(enum_cls, name=name, create_type=False, values_callable=lambda e: [m.value for m in e])


class Campaign(Base, UUIDPK, TimestampMixin):
    __tablename__ = "campaigns"

    channel: Mapped[CampaignChannel] = mapped_column(_enum(CampaignChannel, "campaign_channel"), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    audience: Mapped[str] = mapped_column(String(40), nullable=False, default="all")  # all/junior/explorer/companion/parents
    status: Mapped[CampaignStatus] = mapped_column(
        _enum(CampaignStatus, "campaign_status"), nullable=False, default=CampaignStatus.DRAFT
    )
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    sent_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    failed_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    def __repr__(self) -> str:
        return f"<Campaign {self.channel.value}:{self.title!r} {self.status.value}>"


class NotificationRead(Base, UUIDPK, TimestampMixin):
    """Marks one child as having read one sent campaign.

    A Campaign is one row shared by every recipient, so per-child read state
    can't live on it — this is the join. Absence of a row means unread.
    """

    __tablename__ = "notification_reads"
    __table_args__ = (
        UniqueConstraint("child_id", "campaign_id", name="uq_notification_read_child_campaign"),
    )

    child_id: Mapped[UUID] = mapped_column(
        ForeignKey("child_profiles.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    campaign_id: Mapped[UUID] = mapped_column(
        ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    read_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(),
    )
