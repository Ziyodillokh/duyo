"""Admin API (/v1/admin) — separate-auth admin panel backend.

Faza 0 foundation: email+password login → admin token, /me, and one RBAC-gated
+ audited data endpoint (safety events) proving the pattern. More module
endpoints layer on top of get_current_admin / require_roles / record_audit.
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import func

from duyo.api.deps import get_db
from duyo.api.v1.admin_deps import get_current_admin, record_audit, require_roles
from duyo.core.admin_security import create_admin_token, verify_password
from duyo.models.admin import AdminRole, AdminUser, AuditLog
from duyo.models.child import ChildProfile
from duyo.models.crisis_event import CrisisEvent, CrisisLevel
from duyo.models.message import Message
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
    created_at: datetime

    model_config = {"from_attributes": True}


class ParentRow(BaseModel):
    id: UUID
    phone: str
    children_count: int
    last_login_at: datetime | None
    created_at: datetime


_require_support = require_roles(AdminRole.SUPPORT_AGENT, AdminRole.ADMIN)


@router.get("/users/children", response_model=list[ChildRow])
async def list_children(
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(_require_support),
) -> list[ChildRow]:
    rows = (
        await db.scalars(
            select(ChildProfile).order_by(ChildProfile.created_at.desc()).limit(min(limit, 500))
        )
    ).all()
    return [
        ChildRow(
            id=c.id, name=c.name, age=c.age,
            age_segment=c.age_segment.value if hasattr(c.age_segment, "value") else str(c.age_segment),
            language=c.language.value if hasattr(c.language, "value") else str(c.language),
            created_at=c.created_at,
        )
        for c in rows
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
    stmt = (
        select(User, func.coalesce(child_count.c.n, 0))
        .outerjoin(child_count, child_count.c.parent_id == User.id)
        .order_by(User.created_at.desc())
        .limit(min(limit, 500))
    )
    return [
        ParentRow(
            id=u.id, phone=u.phone, children_count=n,
            last_login_at=u.last_login_at, created_at=u.created_at,
        )
        for u, n in (await db.execute(stmt)).all()
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
