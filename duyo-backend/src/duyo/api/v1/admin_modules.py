"""Admin data endpoints for F2/F3 modules backed by EXISTING models.

Gamification, Parent Monitoring, Monetization, AI logs, Analytics — all read
real rows (gamification/tamagochi/reports/subscriptions/messages). Separate
router file to keep admin.py focused; same /admin prefix. RBAC per spec
(SUPER_ADMIN always passes via require_roles).
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from duyo.api.deps import get_db
from duyo.api.v1.admin_deps import get_current_admin, record_audit, require_roles
from duyo.models.admin import AdminRole, AdminUser
from duyo.models.child import ChildProfile
from duyo.models.content import ContentItem, ContentType, LicenseStatus, ReviewStatus
from duyo.models.gamification import Avatar, BallsTransaction, InventoryItem, Streak
from duyo.models.message import Message, MessageRole
from duyo.models.report import Report
from duyo.models.subscription import Subscription
from duyo.models.tamagochi import TamagochiState
from duyo.models.user import User

router = APIRouter(prefix="/admin", tags=["admin"])

_require_finance = require_roles(AdminRole.FINANCE_MANAGER)
_require_analyst = require_roles(AdminRole.ANALYST, AdminRole.ADMIN)
_require_content = require_roles(AdminRole.CONTENT_MANAGER)


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


# ---- Content Library (Content Manager) ----
class ContentRow(BaseModel):
    id: UUID
    type: str
    title: str
    age_segment: str
    language: str
    author: str | None
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
