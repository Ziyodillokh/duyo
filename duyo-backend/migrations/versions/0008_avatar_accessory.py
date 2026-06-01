"""avatar: accent_color (hex) → accent (accessory), align value vocab to app

The mobile avatar customizer models four dimensions as named option keys
(body sphere/cube/vertical/mini, color blue/purple/green/red, accent
none/star/cap/glasses, face smile/curious/sunny/wink). The original schema
stored primary/accent as hex colours, but the product treats "accent" as a
wearable accessory (which ties into the inventory shop). This migration renames
accent_color → accent and aligns the stored vocabulary 1:1 with the app, so no
client-side translation is needed.

Revision ID: 0008_avatar_accessory
Revises: 0007_admin
Create Date: 2026-06-01
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0008_avatar_accessory"
down_revision: str | None = "0007_admin"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # accent_color (hex, 7) → accent (accessory key, 20)
    op.alter_column(
        "avatars",
        "accent_color",
        new_column_name="accent",
        existing_type=sa.String(7),
        type_=sa.String(20),
        existing_nullable=False,
        server_default="star",
    )
    op.alter_column(
        "avatars",
        "primary_color",
        existing_type=sa.String(7),
        type_=sa.String(20),
        existing_nullable=False,
        server_default="blue",
    )
    op.alter_column(
        "avatars", "body_shape", existing_type=sa.String(20),
        existing_nullable=False, server_default="sphere",
    )
    op.alter_column(
        "avatars", "face_style", existing_type=sa.String(20),
        existing_nullable=False, server_default="smile",
    )

    # Remap existing rows from the old vocabulary to the new option keys.
    op.execute("UPDATE avatars SET body_shape='sphere' WHERE body_shape='spherical'")
    op.execute("UPDATE avatars SET body_shape='cube' WHERE body_shape='cubic'")
    op.execute("UPDATE avatars SET face_style='smile' WHERE face_style IN ('friendly', 'calm', 'wise')")
    op.execute("UPDATE avatars SET primary_color='blue' WHERE primary_color LIKE '#%'")
    op.execute("UPDATE avatars SET accent='star' WHERE accent LIKE '#%'")


def downgrade() -> None:
    op.alter_column(
        "avatars",
        "accent",
        new_column_name="accent_color",
        existing_type=sa.String(20),
        type_=sa.String(7),
        existing_nullable=False,
        server_default="#FFD166",
    )
    op.alter_column(
        "avatars",
        "primary_color",
        existing_type=sa.String(20),
        type_=sa.String(7),
        existing_nullable=False,
        server_default="#4F8DFD",
    )
    op.alter_column(
        "avatars", "body_shape", existing_type=sa.String(20),
        existing_nullable=False, server_default="spherical",
    )
    op.alter_column(
        "avatars", "face_style", existing_type=sa.String(20),
        existing_nullable=False, server_default="friendly",
    )
