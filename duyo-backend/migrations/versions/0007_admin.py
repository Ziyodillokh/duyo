"""admin panel: admin_users + audit_logs (admin-panel spec §2, §9)

Separate-auth admin accounts (email + PBKDF2 password, role) and an audit trail
for every sensitive admin action.

Revision ID: 0007_admin
Revises: 0006_reports
Create Date: 2026-06-01
"""

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0007_admin"
down_revision: Union[str, None] = "0006_reports"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_UUID = postgresql.UUID(as_uuid=True)
_NOW = sa.func.now()

_ROLES = (
    "super_admin",
    "admin",
    "safety_officer",
    "content_manager",
    "support_agent",
    "finance_manager",
    "school_admin",
    "analyst",
)


def upgrade() -> None:
    admin_role = postgresql.ENUM(*_ROLES, name="admin_role", create_type=False)
    admin_role.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "admin_users",
        sa.Column("id", _UUID, primary_key=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(120), nullable=False, server_default=""),
        sa.Column("role", admin_role, nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=_NOW, nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=_NOW, nullable=False),
    )
    op.create_index("ix_admin_users_email", "admin_users", ["email"], unique=True)

    op.create_table(
        "audit_logs",
        sa.Column("id", _UUID, primary_key=True),
        sa.Column("admin_id", _UUID, sa.ForeignKey("admin_users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("admin_email", sa.String(255), nullable=False),
        sa.Column("action", sa.String(80), nullable=False),
        sa.Column("module", sa.String(60), nullable=False),
        sa.Column("target", sa.String(255), nullable=True),
        sa.Column("meta", postgresql.JSONB(), nullable=True),
        sa.Column("ip", sa.String(64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=_NOW, nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=_NOW, nullable=False),
    )
    op.create_index("ix_audit_logs_admin_id", "audit_logs", ["admin_id"])


def downgrade() -> None:
    op.drop_index("ix_audit_logs_admin_id", table_name="audit_logs")
    op.drop_table("audit_logs")
    op.drop_index("ix_admin_users_email", table_name="admin_users")
    op.drop_table("admin_users")
    postgresql.ENUM(name="admin_role").drop(op.get_bind(), checkfirst=True)
