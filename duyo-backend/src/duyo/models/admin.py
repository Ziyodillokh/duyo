"""Admin panel models — AdminUser (separate from child-facing User) + AuditLog.

Admin auth is deliberately isolated from the parent/child OTP identity: admins
log in with email + password and carry an admin-scoped token with a role. Every
sensitive admin action is recorded in AuditLog.
"""

from datetime import datetime
from enum import Enum
from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import ENUM, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from duyo.models.base import UUIDPK, Base, TimestampMixin


class AdminRole(str, Enum):
    """8 roles (admin-panel spec §6). super_admin = full access."""

    SUPER_ADMIN = "super_admin"
    ADMIN = "admin"
    SAFETY_OFFICER = "safety_officer"
    CONTENT_MANAGER = "content_manager"
    SUPPORT_AGENT = "support_agent"
    FINANCE_MANAGER = "finance_manager"
    SCHOOL_ADMIN = "school_admin"
    ANALYST = "analyst"


_admin_role_enum = ENUM(
    AdminRole,
    name="admin_role",
    create_type=False,
    values_callable=lambda enum_cls: [e.value for e in enum_cls],
)


class AdminUser(Base, UUIDPK, TimestampMixin):
    __tablename__ = "admin_users"

    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    # PBKDF2-HMAC-SHA256, format "pbkdf2_sha256$<iterations>$<salt_hex>$<hash_hex>".
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(120), nullable=False, default="")
    role: Mapped[AdminRole] = mapped_column(_admin_role_enum, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    def __repr__(self) -> str:
        return f"<AdminUser id={self.id} email={self.email} role={self.role.value}>"


class AuditLog(Base, UUIDPK, TimestampMixin):
    __tablename__ = "audit_logs"

    admin_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("admin_users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    admin_email: Mapped[str] = mapped_column(String(255), nullable=False)  # denormalised snapshot
    action: Mapped[str] = mapped_column(String(80), nullable=False)   # e.g. "view", "approve", "login"
    module: Mapped[str] = mapped_column(String(60), nullable=False)   # e.g. "safety", "rag"
    target: Mapped[str | None] = mapped_column(String(255), nullable=True)  # affected entity id/desc
    meta: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    ip: Mapped[str | None] = mapped_column(String(64), nullable=True)

    def __repr__(self) -> str:
        return f"<AuditLog {self.admin_email} {self.action}:{self.module}>"
