"""family_invites + child_profiles.child_user_id: independent child accounts

Lets a child log in on their own phone/device instead of sharing the
parent's login. `child_user_id` is the child's own User row once linked;
`family_invites` is the pending state between "parent entered the child's
phone number" and "that phone number completed its own OTP login".

Revision ID: 0029_family_invites
Revises: 0028_notification_reads
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0029_family_invites"
down_revision: str | None = "0028_notification_reads"
branch_labels: str | None = None
depends_on: str | None = None

_UUID = postgresql.UUID(as_uuid=True)
_NOW = sa.func.now()


def upgrade() -> None:
    op.add_column(
        "child_profiles",
        sa.Column(
            "child_user_id", _UUID,
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_unique_constraint(
        "uq_child_profiles_child_user_id", "child_profiles", ["child_user_id"],
    )

    op.create_table(
        "family_invites",
        sa.Column("id", _UUID, primary_key=True),
        sa.Column(
            "parent_id", _UUID,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("child_name", sa.String(80), nullable=False),
        sa.Column("child_phone", sa.String(20), nullable=False),
        sa.Column("claimed", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column(
            "claimed_by_user_id", _UUID,
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("claimed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=_NOW, nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=_NOW, nullable=False),
    )
    op.create_index("ix_family_invites_parent_id", "family_invites", ["parent_id"])
    op.create_index("ix_family_invites_child_phone", "family_invites", ["child_phone"])


def downgrade() -> None:
    op.drop_index("ix_family_invites_child_phone", table_name="family_invites")
    op.drop_index("ix_family_invites_parent_id", table_name="family_invites")
    op.drop_table("family_invites")
    op.drop_constraint("uq_child_profiles_child_user_id", "child_profiles", type_="unique")
    op.drop_column("child_profiles", "child_user_id")
