"""Child-facing notifications — read side of admin-composed Campaigns.

An admin composes and sends a Campaign (see api/v1/admin_modules.py). This
router is what a child's own device sees: campaigns sent to their age
segment (or "all"), each with whether *this* child has read it — tracked in
NotificationRead since a Campaign row is shared by every recipient.

Only push/in_app campaigns show up here — sms/email are delivered outside
the app and have no reason to also appear in an in-app list.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from duyo.api.deps import get_current_user, get_db
from duyo.models.child import ChildProfile
from duyo.models.notification import Campaign, CampaignChannel, CampaignStatus, NotificationRead
from duyo.models.user import User
from duyo.schemas.notification import NotificationItem, UnreadCount

router = APIRouter(prefix="/notifications", tags=["notifications"])

_IN_APP_CHANNELS = (CampaignChannel.IN_APP, CampaignChannel.PUSH)
_LIST_LIMIT = 100


async def _owned_child(child_id: UUID, user: User, db: AsyncSession) -> ChildProfile:
    child = await db.scalar(
        select(ChildProfile).where(
            ChildProfile.id == child_id,
            (ChildProfile.parent_id == user.id) | (ChildProfile.child_user_id == user.id),
        )
    )
    if child is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Child not found")
    return child


def _audience_filter(child: ChildProfile):
    return Campaign.audience.in_(["all", child.age_segment.value])


@router.get("", response_model=list[NotificationItem])
async def list_notifications(
    child_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[NotificationItem]:
    child = await _owned_child(child_id, current_user, db)

    rows = (
        await db.execute(
            select(Campaign)
            .where(
                Campaign.status == CampaignStatus.SENT,
                Campaign.channel.in_(_IN_APP_CHANNELS),
                _audience_filter(child),
            )
            .order_by(Campaign.sent_at.desc(), Campaign.created_at.desc())
            .limit(_LIST_LIMIT)
        )
    ).scalars().all()
    if not rows:
        return []

    read_ids = set(
        (
            await db.scalars(
                select(NotificationRead.campaign_id).where(
                    NotificationRead.child_id == child.id,
                    NotificationRead.campaign_id.in_([r.id for r in rows]),
                )
            )
        ).all()
    )
    return [
        NotificationItem(
            id=r.id, channel=r.channel.value, title=r.title, body=r.body,
            sent_at=r.sent_at, read=r.id in read_ids,
        )
        for r in rows
    ]


@router.get("/unread-count", response_model=UnreadCount)
async def unread_count(
    child_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UnreadCount:
    child = await _owned_child(child_id, current_user, db)

    total = await db.scalar(
        select(func.count(Campaign.id)).where(
            Campaign.status == CampaignStatus.SENT,
            Campaign.channel.in_(_IN_APP_CHANNELS),
            _audience_filter(child),
        )
    ) or 0
    read = await db.scalar(
        select(func.count(NotificationRead.id))
        .join(Campaign, Campaign.id == NotificationRead.campaign_id)
        .where(
            NotificationRead.child_id == child.id,
            Campaign.status == CampaignStatus.SENT,
            Campaign.channel.in_(_IN_APP_CHANNELS),
            _audience_filter(child),
        )
    ) or 0
    return UnreadCount(count=max(0, int(total) - int(read)))


@router.post("/{campaign_id}/read", response_model=NotificationItem)
async def mark_read(
    campaign_id: UUID,
    child_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> NotificationItem:
    child = await _owned_child(child_id, current_user, db)

    campaign = await db.scalar(
        select(Campaign).where(
            Campaign.id == campaign_id,
            Campaign.status == CampaignStatus.SENT,
            Campaign.channel.in_(_IN_APP_CHANNELS),
            _audience_filter(child),
        )
    )
    if campaign is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Notification not found")

    # Idempotent: re-reading an already-read notification is a no-op, not a
    # conflict — the unique constraint exists to prevent duplicates, not to
    # reject repeat calls from a client that doesn't track local read state.
    stmt = (
        pg_insert(NotificationRead)
        .values(child_id=child.id, campaign_id=campaign.id)
        .on_conflict_do_nothing(constraint="uq_notification_read_child_campaign")
    )
    await db.execute(stmt)
    await db.flush()

    return NotificationItem(
        id=campaign.id, channel=campaign.channel.value, title=campaign.title,
        body=campaign.body, sent_at=campaign.sent_at, read=True,
    )
