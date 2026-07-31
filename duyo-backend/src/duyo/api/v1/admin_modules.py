"""Admin data endpoints for F2/F3 modules backed by EXISTING models.

Gamification, Parent Monitoring, Monetization, AI logs, Analytics — all read
real rows (gamification/tamagochi/reports/subscriptions/messages). Separate
router file to keep admin.py focused; same /admin prefix. RBAC per spec
(SUPER_ADMIN always passes via require_roles).
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from duyo.api.deps import get_db
from duyo.api.v1.admin_deps import get_current_admin, record_audit, require_roles
from duyo.core import storage
from duyo.models.admin import AdminRole, AdminUser
from duyo.models.child import ChildProfile
from duyo.models.content import ContentItem, ContentType, LicenseStatus, ReviewStatus
from duyo.models.conversation import Conversation
from duyo.models.feedback import FeedbackRating, MessageFeedback
from duyo.models.gamification import Avatar, BallsTransaction, InventoryItem, Streak
from duyo.models.message import Message, MessageRole
from duyo.models.notification import Campaign, CampaignChannel, CampaignStatus
from duyo.models.payment import Payment, PaymentState
from duyo.models.report import Report
from duyo.models.subscription import Subscription
from duyo.models.tamagochi import TamagochiState
from duyo.models.user import User

router = APIRouter(prefix="/admin", tags=["admin"])

_require_finance = require_roles(AdminRole.FINANCE_MANAGER)
_require_analyst = require_roles(AdminRole.ANALYST, AdminRole.ADMIN)
_require_content = require_roles(AdminRole.CONTENT_MANAGER)
_require_admin = require_roles(AdminRole.ADMIN)


# ---- Gamification ----
@router.get("/gamification/overview")
async def gamification_overview(
    db: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(get_current_admin),
) -> dict:
    avatars = await db.scalar(select(func.count()).select_from(Avatar)) or 0
    inv = await db.scalar(select(func.count()).select_from(InventoryItem)) or 0
    balls_issued = await db.scalar(select(func.coalesce(func.sum(BallsTransaction.amount), 0))) or 0
    streak_max = await db.scalar(select(func.coalesce(func.max(Streak.longest_streak), 0))) or 0
    tamagochi = {
        "energy": float(await db.scalar(select(func.coalesce(func.avg(TamagochiState.energy), 0))) or 0),
        "joy": float(await db.scalar(select(func.coalesce(func.avg(TamagochiState.joy), 0))) or 0),
        "learning": float(await db.scalar(select(func.coalesce(func.avg(TamagochiState.learning), 0))) or 0),
        "health": float(await db.scalar(select(func.coalesce(func.avg(TamagochiState.health), 0))) or 0),
    }
    by_reason = {
        reason: total
        for reason, total in (
            await db.execute(
                select(BallsTransaction.reason, func.coalesce(func.sum(BallsTransaction.amount), 0)).group_by(
                    BallsTransaction.reason
                )
            )
        ).all()
    }
    by_category = {
        cat: n
        for cat, n in (
            await db.execute(select(InventoryItem.category, func.count()).group_by(InventoryItem.category))
        ).all()
    }
    return {
        "avatars": avatars,
        "inventory_items": inv,
        "balls_issued": int(balls_issued),
        "longest_streak": int(streak_max),
        "tamagochi_avg": {k: round(v, 1) for k, v in tamagochi.items()},
        "balls_by_reason": by_reason,
        "inventory_by_category": by_category,
    }


# ---- Reply feedback (human-gated learning dataset — see models/feedback.py) ----
class FeedbackRow(BaseModel):
    id: UUID
    message_id: UUID
    child_id: UUID
    rating: str
    reason: str | None
    reviewed_at: datetime | None
    reviewed_by: str | None
    created_at: datetime
    # DUYO's own reply — the thing being rated. The CHILD's message is
    # deliberately NOT exposed: reply quality can be judged from the reply, and
    # not shipping the child's words keeps this queue free of their private text.
    reply: str | None = None

    model_config = {"from_attributes": True}


@router.get("/feedback", response_model=list[FeedbackRow])
async def feedback_list(
    unreviewed_only: bool = False,
    rating: str | None = None,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(get_current_admin),
) -> list[FeedbackRow]:
    """Rated replies, newest first — the review queue before any prompt change."""
    stmt = select(MessageFeedback, Message.content).join(
        Message, MessageFeedback.message_id == Message.id
    )
    if unreviewed_only:
        stmt = stmt.where(MessageFeedback.reviewed_at.is_(None))
    if rating in ("up", "down"):
        stmt = stmt.where(MessageFeedback.rating == FeedbackRating(rating))
    stmt = stmt.order_by(MessageFeedback.created_at.desc()).limit(min(limit, 500))

    out: list[FeedbackRow] = []
    for fb, reply in (await db.execute(stmt)).all():
        row = FeedbackRow.model_validate(fb)
        row.reply = reply
        out.append(row)
    return out


@router.get("/feedback/summary")
async def feedback_summary(
    db: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(get_current_admin),
) -> dict[str, int]:
    total = await db.scalar(select(func.count()).select_from(MessageFeedback)) or 0
    up = await db.scalar(
        select(func.count()).select_from(MessageFeedback)
        .where(MessageFeedback.rating == FeedbackRating.UP)
    ) or 0
    down = await db.scalar(
        select(func.count()).select_from(MessageFeedback)
        .where(MessageFeedback.rating == FeedbackRating.DOWN)
    ) or 0
    unreviewed = await db.scalar(
        select(func.count()).select_from(MessageFeedback)
        .where(MessageFeedback.reviewed_at.is_(None))
    ) or 0
    return {"total": total, "up": up, "down": down, "unreviewed": unreviewed}


@router.post("/feedback/{feedback_id}/review", response_model=FeedbackRow)
async def feedback_review(
    feedback_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    admin: AdminUser = Depends(get_current_admin),
) -> FeedbackRow:
    """Mark a rated reply as triaged (mirrors safety/events/{id}/review)."""
    fb = await db.scalar(select(MessageFeedback).where(MessageFeedback.id == feedback_id))
    if fb is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Feedback topilmadi")
    fb.reviewed_at = datetime.now(UTC)
    fb.reviewed_by = admin.email
    await db.flush()
    await record_audit(
        db, admin, action="review", module="feedback",
        target=str(feedback_id), request=request,
    )
    return FeedbackRow.model_validate(fb)


# ---- Parent Monitoring (aggregate reports only — no raw chat) ----
class ReportRow(BaseModel):
    id: UUID
    child_id: UUID
    period_start: datetime
    period_end: datetime
    llm_ok: bool
    created_at: datetime

    model_config = {"from_attributes": True}


@router.get("/parents/reports", response_model=list[ReportRow])
async def parent_reports(
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(get_current_admin),
) -> list[ReportRow]:
    rows = (await db.scalars(select(Report).order_by(Report.created_at.desc()).limit(min(limit, 500)))).all()
    return [ReportRow.model_validate(r) for r in rows]


@router.get("/parents/summary")
async def parent_summary(
    db: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(get_current_admin),
) -> dict[str, int]:
    total = await db.scalar(select(func.count()).select_from(Report)) or 0
    llm_ok = await db.scalar(select(func.count()).select_from(Report).where(Report.llm_ok.is_(True))) or 0
    return {"reports_total": total, "reports_llm_ok": llm_ok}


# ---- Monetization (subscriptions real; payments are mock elsewhere) ----
class SubscriptionRow(BaseModel):
    id: UUID
    user_id: UUID
    tier: str
    status: str
    provider: str | None
    started_at: datetime | None
    expires_at: datetime | None

    model_config = {"from_attributes": True}


@router.get("/monetization/subscriptions", response_model=list[SubscriptionRow])
async def subscriptions_list(
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(_require_finance),
) -> list[SubscriptionRow]:
    rows = (
        await db.scalars(select(Subscription).order_by(Subscription.created_at.desc()).limit(min(limit, 500)))
    ).all()
    return [SubscriptionRow.model_validate(r) for r in rows]


@router.get("/monetization/summary")
async def monetization_summary(
    db: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(_require_finance),
) -> dict:
    by_tier = {
        tier: n
        for tier, n in (
            await db.execute(select(Subscription.tier, func.count()).group_by(Subscription.tier))
        ).all()
    }
    by_status = {
        st: n
        for st, n in (
            await db.execute(select(Subscription.status, func.count()).group_by(Subscription.status))
        ).all()
    }
    return {"by_tier": by_tier, "by_status": by_status}


class PaymentRow(BaseModel):
    id: UUID
    user_id: UUID
    provider: str
    tier: str
    period: str
    amount: int
    state: str
    provider_trans_id: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


@router.get("/monetization/payments", response_model=list[PaymentRow])
async def payments_list(
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(_require_finance),
) -> list[PaymentRow]:
    rows = (
        await db.scalars(select(Payment).order_by(Payment.created_at.desc()).limit(min(limit, 500)))
    ).all()
    return [
        PaymentRow(
            id=p.id, user_id=p.user_id,
            provider=p.provider.value if hasattr(p.provider, "value") else str(p.provider),
            tier=p.tier, period=p.period, amount=p.amount,
            state=p.state.value if hasattr(p.state, "value") else str(p.state),
            provider_trans_id=p.provider_trans_id, created_at=p.created_at,
        )
        for p in rows
    ]


@router.get("/monetization/payments/summary")
async def payments_summary(
    db: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(_require_finance),
) -> dict:
    by_state = {
        (st.value if hasattr(st, "value") else str(st)): n
        for st, n in (await db.execute(select(Payment.state, func.count()).group_by(Payment.state))).all()
    }
    by_provider = {
        (pr.value if hasattr(pr, "value") else str(pr)): n
        for pr, n in (await db.execute(select(Payment.provider, func.count()).group_by(Payment.provider))).all()
    }
    # Realized revenue = sum of PAID payments (so'm).
    revenue = await db.scalar(
        select(func.coalesce(func.sum(Payment.amount), 0)).where(Payment.state == PaymentState.PAID)
    ) or 0
    return {"by_state": by_state, "by_provider": by_provider, "revenue": int(revenue)}


# ---- AI logs ----
class AiLogRow(BaseModel):
    id: UUID
    model: str | None
    latency_ms: int | None
    tokens_in: int | None
    tokens_out: int | None
    created_at: datetime

    model_config = {"from_attributes": True}


@router.get("/ai/logs", response_model=list[AiLogRow])
async def ai_logs(
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(get_current_admin),
) -> list[AiLogRow]:
    rows = (
        await db.scalars(
            select(Message)
            .where(Message.role == MessageRole.ASSISTANT)
            .order_by(Message.created_at.desc())
            .limit(min(limit, 500))
        )
    ).all()
    return [AiLogRow.model_validate(r) for r in rows]


@router.get("/ai/summary")
async def ai_summary(
    db: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(get_current_admin),
) -> dict:
    base = select(Message).where(Message.role == MessageRole.ASSISTANT).subquery()
    total = await db.scalar(select(func.count()).select_from(base)) or 0
    avg_latency = await db.scalar(
        select(func.coalesce(func.avg(Message.latency_ms), 0)).where(Message.role == MessageRole.ASSISTANT)
    ) or 0
    tokens_in = await db.scalar(
        select(func.coalesce(func.sum(Message.tokens_in), 0)).where(Message.role == MessageRole.ASSISTANT)
    ) or 0
    tokens_out = await db.scalar(
        select(func.coalesce(func.sum(Message.tokens_out), 0)).where(Message.role == MessageRole.ASSISTANT)
    ) or 0
    by_model = {
        (m or "unknown"): n
        for m, n in (
            await db.execute(
                select(Message.model, func.count())
                .where(Message.role == MessageRole.ASSISTANT)
                .group_by(Message.model)
            )
        ).all()
    }
    return {
        "messages": total,
        "avg_latency_ms": round(float(avg_latency)),
        "tokens_in": int(tokens_in),
        "tokens_out": int(tokens_out),
        "by_model": by_model,
    }


# ---- Analytics ----
@router.get("/analytics/overview")
async def analytics_overview(
    db: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(_require_analyst),
) -> dict:
    children = await db.scalar(select(func.count()).select_from(ChildProfile)) or 0
    parents = await db.scalar(select(func.count()).select_from(User)) or 0
    messages = await db.scalar(select(func.count()).select_from(Message)) or 0
    # Messages per day (last 14 days).
    per_day = [
        {"day": str(day), "count": n}
        for day, n in (
            await db.execute(
                select(func.date(Message.created_at).label("day"), func.count())
                .group_by(func.date(Message.created_at))
                .order_by(func.date(Message.created_at).desc())
                .limit(14)
            )
        ).all()
    ]
    return {
        "children": children,
        "parents": parents,
        "messages": messages,
        "messages_per_day": list(reversed(per_day)),
    }


# A parent counts as "active" in a window if any of their children sent a
# CHILD message in it: messages → conversations → child_profiles.parent_id.
def _active_parents_since(since: datetime):
    return (
        select(func.count(func.distinct(ChildProfile.parent_id)))
        .select_from(Message)
        .join(Conversation, Message.conversation_id == Conversation.id)
        .join(ChildProfile, Conversation.child_id == ChildProfile.id)
        .where(Message.role == MessageRole.CHILD, Message.created_at >= since)
    )


@router.get("/analytics/engagement")
async def analytics_engagement(
    db: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(_require_analyst),
) -> dict:
    """Active parents (DAU/WAU/MAU), stickiness, and 30-day signup trend."""
    now = datetime.now(UTC)
    dau = await db.scalar(_active_parents_since(now - timedelta(days=1))) or 0
    wau = await db.scalar(_active_parents_since(now - timedelta(days=7))) or 0
    mau = await db.scalar(_active_parents_since(now - timedelta(days=30))) or 0
    signups = [
        {"day": str(day), "count": n}
        for day, n in (
            await db.execute(
                select(func.date(User.created_at).label("day"), func.count())
                .where(User.created_at >= now - timedelta(days=30))
                .group_by(func.date(User.created_at))
                .order_by(func.date(User.created_at))
            )
        ).all()
    ]
    return {
        "dau": dau, "wau": wau, "mau": mau,
        "stickiness": round(dau / mau, 3) if mau else 0.0,  # DAU/MAU
        "signups_per_day": signups,
    }


def _build_cohort_matrix(
    sizes: dict[str, int], buckets: list[tuple[str, int, int]], max_weeks: int,
) -> list[dict]:
    """Assemble weekly retention rows from cohort sizes and (cohort, week_offset,
    active_users) buckets. retention[k] = active_in_week_k / cohort_size."""
    rows = []
    for cohort in sorted(sizes, reverse=True):
        size = sizes[cohort]
        active = {wk: n for c, wk, n in buckets if c == cohort}
        retention = [
            round(active.get(k, 0) / size, 3) if size else 0.0
            for k in range(max_weeks + 1)
        ]
        rows.append({"cohort": cohort, "size": size, "retention": retention})
    return rows


@router.get("/analytics/retention")
async def analytics_retention(
    weeks: int = 6,
    db: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(_require_analyst),
) -> dict:
    """Weekly signup cohorts x retention per week-since-signup (% active)."""
    max_weeks = max(1, min(weeks, 12))
    since = datetime.now(UTC) - timedelta(weeks=max_weeks + 1)

    cohort_col = func.date_trunc("week", User.created_at)
    sizes = {
        str(c.date()): n
        for c, n in (
            await db.execute(
                select(cohort_col.label("c"), func.count())
                .where(User.created_at >= since)
                .group_by(cohort_col)
            )
        ).all()
    }

    user_week = func.date_trunc("week", User.created_at)
    msg_week = func.date_trunc("week", Message.created_at)
    week_offset = func.floor(
        func.extract("epoch", msg_week - user_week) / 604800  # seconds per week
    )
    buckets = [
        (str(c.date()), int(wk), n)
        for c, wk, n in (
            await db.execute(
                select(user_week.label("c"), week_offset.label("wk"), func.count(func.distinct(User.id)))
                .select_from(Message)
                .join(Conversation, Message.conversation_id == Conversation.id)
                .join(ChildProfile, Conversation.child_id == ChildProfile.id)
                .join(User, ChildProfile.parent_id == User.id)
                .where(Message.role == MessageRole.CHILD, User.created_at >= since)
                .group_by(user_week, week_offset)
            )
        ).all()
    ]
    return {"weeks": max_weeks, "cohorts": _build_cohort_matrix(sizes, buckets, max_weeks)}


# ---- Content Library (Content Manager) ----
class ContentRow(BaseModel):
    id: UUID
    type: str
    title: str
    age_segment: str
    language: str
    author: str | None
    audio_url: str | None
    image_url: str | None
    pdf_url: str | None
    review_status: str
    license_status: str
    published: bool
    completions: int
    likes: int
    reports: int
    created_at: datetime

    model_config = {"from_attributes": True}


class ContentCreate(BaseModel):
    type: ContentType
    title: str
    body: str | None = None
    age_segment: str = "all"
    language: str = "uz"
    author: str | None = None
    audio_url: str | None = None
    image_url: str | None = None
    pdf_url: str | None = None


class ContentPatch(BaseModel):
    review_status: ReviewStatus | None = None
    license_status: LicenseStatus | None = None
    published: bool | None = None


@router.get("/content", response_model=list[ContentRow])
async def content_list(
    type: ContentType | None = None,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(_require_content),
) -> list[ContentRow]:
    stmt = select(ContentItem).order_by(ContentItem.created_at.desc()).limit(min(limit, 500))
    if type is not None:
        stmt = stmt.where(ContentItem.type == type)
    rows = (await db.scalars(stmt)).all()
    return [ContentRow.model_validate(r) for r in rows]


@router.get("/content/summary")
async def content_summary(
    db: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(_require_content),
) -> dict:
    by_review = {
        st: n
        for st, n in (
            await db.execute(select(ContentItem.review_status, func.count()).group_by(ContentItem.review_status))
        ).all()
    }
    published = await db.scalar(select(func.count()).select_from(ContentItem).where(ContentItem.published.is_(True))) or 0
    return {"by_review": {(k.value if hasattr(k, "value") else str(k)): v for k, v in by_review.items()}, "published": published}


@router.post("/content", response_model=ContentRow, status_code=status.HTTP_201_CREATED)
async def content_create(
    payload: ContentCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    admin: AdminUser = Depends(_require_content),
) -> ContentRow:
    item = ContentItem(**payload.model_dump())
    db.add(item)
    await db.flush()
    await record_audit(db, admin, action="create", module="content", target=str(item.id), request=request)
    return ContentRow.model_validate(item)


class UploadResult(BaseModel):
    url: str
    key: str


@router.post("/content/upload", response_model=UploadResult)
async def content_upload(
    file: UploadFile = File(...),
    _: AdminUser = Depends(_require_content),
) -> UploadResult:
    """Upload a media file (image/pdf/audio) → object storage → served URL.

    Returns the absolute URL to drop into a content item's image_url/pdf_url/
    audio_url field. Type + size are validated in storage.upload.
    """
    data = await file.read()
    try:
        key = storage.upload(data, file.content_type or "application/octet-stream")
    except storage.UploadError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, detail="Faylni saqlab bo'lmadi") from exc
    return UploadResult(url=storage.media_url(key), key=key)


@router.patch("/content/{item_id}", response_model=ContentRow)
async def content_update(
    item_id: UUID,
    payload: ContentPatch,
    request: Request,
    db: AsyncSession = Depends(get_db),
    admin: AdminUser = Depends(_require_content),
) -> ContentRow:
    item = await db.get(ContentItem, item_id)
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Kontent topilmadi")
    if payload.review_status is not None:
        item.review_status = payload.review_status
    if payload.license_status is not None:
        item.license_status = payload.license_status
    if payload.published is not None:
        # Publish gate: license + review must both be APPROVED.
        if payload.published and not (
            item.review_status == ReviewStatus.APPROVED and item.license_status == LicenseStatus.APPROVED
        ):
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                detail="Nashr etib bo'lmaydi: litsenziya va tekshiruv tasdiqlangan bo'lishi shart",
            )
        item.published = payload.published
    await record_audit(
        db, admin, action="update", module="content", target=str(item_id),
        meta=payload.model_dump(exclude_none=True, mode="json"), request=request,
    )
    await db.flush()
    return ContentRow.model_validate(item)


# ---- Notifications / Campaigns (Admin) ----
class CampaignRow(BaseModel):
    id: UUID
    channel: str
    title: str
    body: str
    audience: str
    status: str
    scheduled_at: datetime | None
    sent_at: datetime | None
    sent_count: int
    failed_count: int
    created_at: datetime

    model_config = {"from_attributes": True}


class CampaignCreate(BaseModel):
    channel: CampaignChannel
    title: str
    body: str
    audience: str = "all"
    scheduled_at: datetime | None = None


class CampaignPatch(BaseModel):
    status: CampaignStatus | None = None
    scheduled_at: datetime | None = None


@router.get("/notifications/campaigns", response_model=list[CampaignRow])
async def campaigns_list(
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(_require_admin),
) -> list[CampaignRow]:
    rows = (await db.scalars(select(Campaign).order_by(Campaign.created_at.desc()).limit(min(limit, 500)))).all()
    return [CampaignRow.model_validate(r) for r in rows]


@router.get("/notifications/summary")
async def campaigns_summary(
    db: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(_require_admin),
) -> dict:
    by_status = {
        (s.value if hasattr(s, "value") else str(s)): n
        for s, n in (await db.execute(select(Campaign.status, func.count()).group_by(Campaign.status))).all()
    }
    by_channel = {
        (c.value if hasattr(c, "value") else str(c)): n
        for c, n in (await db.execute(select(Campaign.channel, func.count()).group_by(Campaign.channel))).all()
    }
    return {"by_status": by_status, "by_channel": by_channel}


@router.post("/notifications/campaigns", response_model=CampaignRow, status_code=status.HTTP_201_CREATED)
async def campaign_create(
    payload: CampaignCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    admin: AdminUser = Depends(_require_admin),
) -> CampaignRow:
    item = Campaign(**payload.model_dump())
    db.add(item)
    await db.flush()
    await record_audit(db, admin, action="create", module="notifications", target=str(item.id), request=request)
    return CampaignRow.model_validate(item)


@router.patch("/notifications/campaigns/{campaign_id}", response_model=CampaignRow)
async def campaign_update(
    campaign_id: UUID,
    payload: CampaignPatch,
    request: Request,
    db: AsyncSession = Depends(get_db),
    admin: AdminUser = Depends(_require_admin),
) -> CampaignRow:
    item = await db.get(Campaign, campaign_id)
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Kampaniya topilmadi")
    if payload.scheduled_at is not None:
        item.scheduled_at = payload.scheduled_at
    if payload.status is not None:
        item.status = payload.status
        # Mark sent timestamp when transitioning to SENT (actual delivery wired later).
        if payload.status == CampaignStatus.SENT and item.sent_at is None:
            item.sent_at = datetime.now(item.created_at.tzinfo)
    await record_audit(
        db, admin, action="update", module="notifications", target=str(campaign_id),
        meta=payload.model_dump(exclude_none=True, mode="json"), request=request,
    )
    await db.flush()
    return CampaignRow.model_validate(item)
