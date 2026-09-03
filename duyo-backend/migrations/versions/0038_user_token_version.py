"""users.token_version — the one number that makes a JWT revocable.

A signed token cannot be recalled, so "log out everywhere" is this counter
going up: every token carries the generation it was minted under and stops
being accepted the moment they disagree (core/security.py::is_current).

Server default 0, which is also what a token issued before the claim existed
reads as — so this migration signs nobody out.

Revision ID: 0038_user_token_version
Revises: 0037_child_photo
"""

import sqlalchemy as sa
from alembic import op

revision: str = "0038_user_token_version"
down_revision: str | None = "0037_child_photo"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "token_version",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "token_version")
