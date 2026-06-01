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
from duyo.models.admin import AdminRole, AdminUser
from duyo.models.crisis_event import CrisisEvent, CrisisLevel

router = APIRouter(prefix="/admin", tags=["admin"])

# Module-level dependency singletons (B008: no factory calls in arg defaults).
_require_safety = require_roles(AdminRole.SAFETY_OFFICER)


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
