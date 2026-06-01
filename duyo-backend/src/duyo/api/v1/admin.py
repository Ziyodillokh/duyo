"""Admin API (/v1/admin) — separate-auth admin panel backend.

Faza 0 foundation: email+password login → admin token, /me, and one RBAC-gated
+ audited data endpoint (safety events) proving the pattern. More module
endpoints layer on top of get_current_admin / require_roles / record_audit.
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import func

from duyo.api.deps import get_db
from duyo.api.v1.admin_deps import get_current_admin, record_audit, require_roles
from duyo.core.admin_security import create_admin_token, hash_password, verify_password
from duyo.models.admin import AdminRole, AdminUser, AuditLog
from duyo.models.child import ChildProfile
from duyo.models.crisis_event import CrisisEvent, CrisisLevel
from duyo.models.message import Message
from duyo.models.subscription import Subscription
from duyo.models.textbook_chunk import TextbookChunk
from duyo.models.user import User

router = APIRouter(prefix="/admin", tags=["admin"])

# Module-level dependency singletons (B008: no factory calls in arg defaults).
_require_safety = require_roles(AdminRole.SAFETY_OFFICER)
_require_content = require_roles(AdminRole.CONTENT_MANAGER)


# ---- Schemas ----
class AdminLogin(BaseModel):
    email: str
    password: str


class AdminInfo(BaseModel):
    id: UUID
    email: str
    full_name: str
    role: AdminRole

    model_config = {"from_attributes": True}


class LoginResponse(BaseModel):
    token: str
    admin: AdminInfo


class CrisisEventRow(BaseModel):
    id: UUID
    child_id: UUID
    level: CrisisLevel
    layer: int
    matches: list[dict] | None
    parent_notified: bool
    parent_notified_at: datetime | None
    reviewed_at: datetime | None
    reviewed_by: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ---- Auth ----
@router.post("/auth/login", response_model=LoginResponse)
async def admin_login(payload: AdminLogin, db: AsyncSession = Depends(get_db)) -> LoginResponse:
    admin = await db.scalar(select(AdminUser).where(AdminUser.email == payload.email.lower()))
    if admin is None or not admin.is_active or not verify_password(payload.password, admin.password_hash):
        # Generic message — don't reveal whether the email exists.
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Email yoki parol noto'g'ri")
    admin.last_login_at = datetime.now(admin.created_at.tzinfo)
    await record_audit(db, admin, action="login", module="auth")
    token = create_admin_token(str(admin.id), admin.role.value)
    return LoginResponse(token=token, admin=AdminInfo.model_validate(admin))


@router.get("/me", response_model=AdminInfo)
async def admin_me(admin: AdminUser = Depends(get_current_admin)) -> AdminInfo:
    return AdminInfo.model_validate(admin)


# ---- Safety (Safety Officer only) ----
@router.get("/safety/events", response_model=list[CrisisEventRow])
async def list_crisis_events(
    request: Request,
    level: CrisisLevel | None = None,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    admin: AdminUser = Depends(_require_safety),
) -> list[CrisisEventRow]:
    stmt = select(CrisisEvent).order_by(CrisisEvent.created_at.desc()).limit(min(limit, 200))
    if level is not None:
        stmt = stmt.where(CrisisEvent.level == level)
    rows = (await db.scalars(stmt)).all()
    await record_audit(
        db, admin, action="view", module="safety",
        target=f"events(level={level.value if level else 'all'})",
        meta={"count": len(rows)}, request=request,
    )
    return [CrisisEventRow.model_validate(r) for r in rows]


async def _get_crisis_or_404(db: AsyncSession, event_id: UUID) -> CrisisEvent:
    event = await db.scalar(select(CrisisEvent).where(CrisisEvent.id == event_id))
    if event is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Krizis hodisasi topilmadi")
    return event


@router.post("/safety/events/{event_id}/notify-parent", response_model=CrisisEventRow)
async def notify_parent(
    event_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    admin: AdminUser = Depends(_require_safety),
) -> CrisisEventRow:
    """Mark the parent as notified about this crisis (idempotent)."""
    event = await _get_crisis_or_404(db, event_id)
    if not event.parent_notified:
        event.parent_notified = True
        event.parent_notified_at = datetime.now(event.created_at.tzinfo)
        await db.flush()
        await record_audit(
            db, admin, action="notify_parent", module="safety",
            target=str(event_id), request=request,
        )
    return CrisisEventRow.model_validate(event)


@router.post("/safety/events/{event_id}/review", response_model=CrisisEventRow)
async def review_crisis(
    event_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    admin: AdminUser = Depends(_require_safety),
) -> CrisisEventRow:
    """Mark this crisis as reviewed/handled by the current safety admin."""
    event = await _get_crisis_or_404(db, event_id)
    event.reviewed_at = datetime.now(event.created_at.tzinfo)
    event.reviewed_by = admin.email
    await db.flush()
    await record_audit(
        db, admin, action="review", module="safety",
        target=str(event_id), request=request,
    )
    return CrisisEventRow.model_validate(event)


# ---- Stats (any admin) ----
@router.get("/safety/summary")
async def safety_summary(
    db: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(get_current_admin),
) -> dict[str, int]:
    stmt = select(CrisisEvent.level, func.count()).group_by(CrisisEvent.level)
    counts = {level.value: 0 for level in CrisisLevel}
    for level, n in (await db.execute(stmt)).all():
        counts[level.value if hasattr(level, "value") else str(level)] = n
    return counts


# ---- Dashboard (any admin) ----
class DashboardSummary(BaseModel):
    children: int
    parents: int
    messages_total: int
    textbook_chunks: int
    textbook_subjects: int
    crisis: dict[str, int]


@router.get("/dashboard/summary", response_model=DashboardSummary)
async def dashboard_summary(
    db: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(get_current_admin),
) -> DashboardSummary:
    children = await db.scalar(select(func.count()).select_from(ChildProfile)) or 0
    parents = await db.scalar(select(func.count()).select_from(User)) or 0
    messages = await db.scalar(select(func.count()).select_from(Message)) or 0
    chunks = await db.scalar(select(func.count()).select_from(TextbookChunk)) or 0
    subjects = await db.scalar(select(func.count(func.distinct(TextbookChunk.subject)))) or 0
    crisis = {level.value: 0 for level in CrisisLevel}
    for level, n in (await db.execute(select(CrisisEvent.level, func.count()).group_by(CrisisEvent.level))).all():
        crisis[level.value if hasattr(level, "value") else str(level)] = n
    return DashboardSummary(
        children=children, parents=parents, messages_total=messages,
        textbook_chunks=chunks, textbook_subjects=subjects, crisis=crisis,
    )


# ---- RAG knowledge base (Content Manager) ----
class RagDocument(BaseModel):
    subject: str
    grade: int | None
    language: str | None
    chunks: int
    embedded: int


@router.get("/rag/documents", response_model=list[RagDocument])
async def rag_documents(
    db: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(_require_content),
) -> list[RagDocument]:
    stmt = (
        select(
            TextbookChunk.subject,
            TextbookChunk.grade,
            TextbookChunk.language,
            func.count().label("chunks"),
            func.count(TextbookChunk.embedding).label("embedded"),
        )
        .group_by(TextbookChunk.subject, TextbookChunk.grade, TextbookChunk.language)
        .order_by(TextbookChunk.grade, TextbookChunk.subject)
    )
    return [
        RagDocument(subject=r.subject, grade=r.grade, language=r.language, chunks=r.chunks, embedded=r.embedded)
        for r in (await db.execute(stmt)).all()
    ]


@router.get("/rag/stats")
async def rag_stats(
    db: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(_require_content),
) -> dict[str, int]:
    chunks = await db.scalar(select(func.count()).select_from(TextbookChunk)) or 0
    embedded = await db.scalar(select(func.count(TextbookChunk.embedding))) or 0
    subjects = await db.scalar(select(func.count(func.distinct(TextbookChunk.subject)))) or 0
    grades = await db.scalar(select(func.count(func.distinct(TextbookChunk.grade)))) or 0
    return {"chunks": chunks, "embedded": embedded, "subjects": subjects, "grades": grades}


# ---- Users & Families (Support Agent / Admin) ----
class ChildRow(BaseModel):
    id: UUID
    name: str
    age: int
    age_segment: str
    language: str
    parent_phone: str | None
    tier: str
    risk: str | None  # latest crisis level (GREEN/YELLOW/ORANGE/RED) or null
    created_at: datetime

    model_config = {"from_attributes": True}


class ParentRow(BaseModel):
    id: UUID
    phone: str
    children_count: int
    tier: str
    last_login_at: datetime | None
    created_at: datetime


_require_support = require_roles(AdminRole.SUPPORT_AGENT, AdminRole.ADMIN)


@router.get("/users/children", response_model=list[ChildRow])
async def list_children(
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(_require_support),
) -> list[ChildRow]:
    # Latest crisis level per child (window → rn==1), and the parent's tier —
    # both as subqueries so the list stays a single query (no N+1).
    crisis_rn = (
        select(
            CrisisEvent.child_id.label("cid"),
            CrisisEvent.level.label("level"),
            func.row_number()
            .over(partition_by=CrisisEvent.child_id, order_by=CrisisEvent.created_at.desc())
            .label("rn"),
        ).subquery()
    )
    latest_crisis = (
        select(crisis_rn.c.cid, crisis_rn.c.level).where(crisis_rn.c.rn == 1).subquery()
    )
    sub_tier = select(Subscription.user_id, Subscription.tier).subquery()

    stmt = (
        select(ChildProfile, User.phone, sub_tier.c.tier, latest_crisis.c.level)
        .join(User, ChildProfile.parent_id == User.id)
        .outerjoin(sub_tier, sub_tier.c.user_id == ChildProfile.parent_id)
        .outerjoin(latest_crisis, latest_crisis.c.cid == ChildProfile.id)
        .order_by(ChildProfile.created_at.desc())
        .limit(min(limit, 500))
    )
    return [
        ChildRow(
            id=c.id, name=c.name, age=c.age,
            age_segment=c.age_segment.value if hasattr(c.age_segment, "value") else str(c.age_segment),
            language=c.language.value if hasattr(c.language, "value") else str(c.language),
            parent_phone=phone,
            tier=tier or "free",
            risk=(level.value if hasattr(level, "value") else level) if level is not None else None,
            created_at=c.created_at,
        )
        for c, phone, tier, level in (await db.execute(stmt)).all()
    ]


@router.get("/users/parents", response_model=list[ParentRow])
async def list_parents(
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(_require_support),
) -> list[ParentRow]:
    child_count = (
        select(ChildProfile.parent_id, func.count().label("n"))
        .group_by(ChildProfile.parent_id)
        .subquery()
    )
    sub_tier = select(Subscription.user_id, Subscription.tier).subquery()
    stmt = (
        select(User, func.coalesce(child_count.c.n, 0), sub_tier.c.tier)
        .outerjoin(child_count, child_count.c.parent_id == User.id)
        .outerjoin(sub_tier, sub_tier.c.user_id == User.id)
        .order_by(User.created_at.desc())
        .limit(min(limit, 500))
    )
    return [
        ParentRow(
            id=u.id, phone=u.phone, children_count=n, tier=tier or "free",
            last_login_at=u.last_login_at, created_at=u.created_at,
        )
        for u, n, tier in (await db.execute(stmt)).all()
    ]


# ---- System: audit log + admins (Super Admin) ----
class AuditRow(BaseModel):
    id: UUID
    admin_email: str
    action: str
    module: str
    target: str | None
    ip: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


@router.get("/audit", response_model=list[AuditRow])
async def list_audit(
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(get_current_admin),  # any authenticated admin
) -> list[AuditRow]:
    rows = (
        await db.scalars(select(AuditLog).order_by(AuditLog.created_at.desc()).limit(min(limit, 500)))
    ).all()
    return [AuditRow.model_validate(r) for r in rows]


@router.get("/admins/summary")
async def admins_summary(
    db: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(get_current_admin),
) -> dict[str, int]:
    stmt = select(AdminUser.role, func.count()).group_by(AdminUser.role)
    counts = {role.value: 0 for role in AdminRole}
    for role, n in (await db.execute(stmt)).all():
        counts[role.value if hasattr(role, "value") else str(role)] = n
    return counts


# ---- Admin user management (RBAC) ----
# List is visible to ADMIN+; all mutations are SUPER_ADMIN-only.
_require_admin_mgmt = require_roles(AdminRole.ADMIN)
_require_super = require_roles()  # no extra roles → only SUPER_ADMIN passes
_MIN_PASSWORD = 8


class AdminUserRow(BaseModel):
    id: UUID
    email: str
    full_name: str
    role: AdminRole
    is_active: bool
    last_login_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class CreateAdminRequest(BaseModel):
    email: str
    full_name: str = ""
    role: AdminRole
    password: str = Field(min_length=_MIN_PASSWORD)


class UpdateAdminRequest(BaseModel):
    full_name: str | None = None
    role: AdminRole | None = None
    is_active: bool | None = None


class ResetPasswordRequest(BaseModel):
    password: str = Field(min_length=_MIN_PASSWORD)


async def _get_admin_or_404(db: AsyncSession, admin_id: UUID) -> AdminUser:
    admin = await db.scalar(select(AdminUser).where(AdminUser.id == admin_id))
    if admin is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Admin topilmadi")
    return admin


async def _active_super_admin_count(db: AsyncSession) -> int:
    return (
        await db.scalar(
            select(func.count())
            .select_from(AdminUser)
            .where(AdminUser.role == AdminRole.SUPER_ADMIN, AdminUser.is_active.is_(True))
        )
        or 0
    )


@router.get("/admins", response_model=list[AdminUserRow])
async def list_admins(
    db: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(_require_admin_mgmt),
) -> list[AdminUserRow]:
    rows = (
        await db.scalars(select(AdminUser).order_by(AdminUser.created_at.desc()).limit(500))
    ).all()
    return [AdminUserRow.model_validate(r) for r in rows]


@router.post("/admins", response_model=AdminUserRow, status_code=status.HTTP_201_CREATED)
async def create_admin(
    payload: CreateAdminRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current: AdminUser = Depends(_require_super),
) -> AdminUserRow:
    email = payload.email.strip().lower()
    if "@" not in email or "." not in email.split("@")[-1]:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Email noto'g'ri")
    if await db.scalar(select(AdminUser).where(AdminUser.email == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Bu email allaqachon mavjud")

    admin = AdminUser(
        email=email,
        password_hash=hash_password(payload.password),
        full_name=payload.full_name.strip(),
        role=payload.role,
        is_active=True,
    )
    db.add(admin)
    await db.flush()
    await record_audit(
        db, current, action="create", module="admins",
        target=email, meta={"role": payload.role.value}, request=request,
    )
    return AdminUserRow.model_validate(admin)


@router.patch("/admins/{admin_id}", response_model=AdminUserRow)
async def update_admin(
    admin_id: UUID,
    payload: UpdateAdminRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current: AdminUser = Depends(_require_super),
) -> AdminUserRow:
    target = await _get_admin_or_404(db, admin_id)

    demoting = payload.role is not None and payload.role != target.role and target.role == AdminRole.SUPER_ADMIN
    deactivating = payload.is_active is False and target.is_active

    # Self-lockout guard: a super admin can't strip their own access.
    if target.id == current.id:
        if payload.role is not None and payload.role != AdminRole.SUPER_ADMIN:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="O'z rolingizni pasaytira olmaysiz")
        if payload.is_active is False:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="O'zingizni o'chira olmaysiz")

    # Never remove the last active super admin.
    if (demoting or deactivating) and await _active_super_admin_count(db) <= 1:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Oxirgi super adminni o'zgartirib bo'lmaydi")

    if payload.full_name is not None:
        target.full_name = payload.full_name.strip()
    if payload.role is not None:
        target.role = payload.role
    if payload.is_active is not None:
        target.is_active = payload.is_active
    await db.flush()
    await record_audit(
        db, current, action="update", module="admins",
        target=target.email, meta=payload.model_dump(exclude_none=True), request=request,
    )
    return AdminUserRow.model_validate(target)


@router.post("/admins/{admin_id}/reset-password")
async def reset_admin_password(
    admin_id: UUID,
    payload: ResetPasswordRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current: AdminUser = Depends(_require_super),
) -> dict[str, bool]:
    target = await _get_admin_or_404(db, admin_id)
    target.password_hash = hash_password(payload.password)
    await db.flush()
    await record_audit(
        db, current, action="reset_password", module="admins",
        target=target.email, request=request,
    )
    return {"ok": True}
