"""Admin auth dependencies + audit helper.

`get_current_admin` validates the admin-scoped token. `require_roles(...)` is a
dependency factory that additionally enforces RBAC per route (SUPER_ADMIN always
passes). `record_audit` writes an AuditLog row for sensitive actions.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from uuid import UUID

from fastapi import Depends, Header, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from duyo.api.deps import get_db
from duyo.core.admin_security import decode_admin_token
from duyo.models.admin import AdminRole, AdminUser, AuditLog


async def get_current_admin(
    authorization: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> AdminUser:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Missing admin bearer token")
    token = authorization.split(" ", 1)[1]
    try:
        claims = decode_admin_token(token)
    except Exception as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Invalid admin token") from exc
    try:
        admin_id = UUID(claims["sub"])
    except (KeyError, ValueError) as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Bad subject claim") from exc
    admin = await db.scalar(select(AdminUser).where(AdminUser.id == admin_id))
    if admin is None or not admin.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Admin account inactive")
    return admin


def require_roles(*roles: AdminRole) -> Callable[..., Awaitable[AdminUser]]:
    """Dependency factory: allow only the given roles (SUPER_ADMIN always allowed)."""
    allowed = {AdminRole.SUPER_ADMIN, *roles}

    async def _dep(admin: AdminUser = Depends(get_current_admin)) -> AdminUser:
        if admin.role not in allowed:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                detail=f"Rol '{admin.role.value}' bu amalga ruxsatga ega emas",
            )
        return admin

    return _dep


async def record_audit(
    db: AsyncSession,
    admin: AdminUser,
    *,
    action: str,
    module: str,
    target: str | None = None,
    meta: dict | None = None,
    request: Request | None = None,
) -> None:
    ip = None
    if request is not None and request.client is not None:
        ip = request.client.host
    db.add(
        AuditLog(
            admin_id=admin.id,
            admin_email=admin.email,
            action=action,
            module=module,
            target=target,
            meta=meta,
            ip=ip,
        )
    )
    await db.flush()
