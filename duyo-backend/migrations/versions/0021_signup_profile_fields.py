"""signup profile fields: account role/name + child interests/mascot

Onboarding asked four questions whose answers had nowhere to go: are you a
parent or a child, what is your name, what are you interested in, and which
mascot do you want. All four columns are nullable (interests defaults to an
empty array), so existing rows need no backfill and the deploy needs no
downtime.

Revision ID: 0021_signup_profile
Revises: 0020_mood_entries
Create Date: 2026-08-02
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0021_signup_profile"
down_revision: str | None = "0020_mood_entries"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    account_role = postgresql.ENUM(
        "parent", "child", name="account_role", create_type=False
    )
    account_role.create(op.get_bind(), checkfirst=True)

    op.add_column("users", sa.Column("role", account_role, nullable=True))
    op.add_column("users", sa.Column("display_name", sa.String(80), nullable=True))

    op.add_column(
        "child_profiles",
        sa.Column(
            "interests",
            postgresql.JSONB,
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
    )
    op.add_column("child_profiles", sa.Column("mascot", sa.String(32), nullable=True))


def downgrade() -> None:
    op.drop_column("child_profiles", "mascot")
    op.drop_column("child_profiles", "interests")
    op.drop_column("users", "display_name")
    op.drop_column("users", "role")
    sa.Enum(name="account_role").drop(op.get_bind(), checkfirst=True)
