"""child_notes.colour: child-chosen colour, fallback for a note with no #tag

A tagged note is always coloured by its tag on the graph view — this column
only matters for the untagged case, where the map used to fall back to a
single flat grey for every unconnected note. Nullable: null means "use that
grey", unchanged from before this column existed.

Revision ID: 0024_note_colour
Revises: 0023_child_style_profile
Create Date: 2026-08-09
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0024_note_colour"
down_revision: str | None = "0023_child_style_profile"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("child_notes", sa.Column("colour", sa.String(length=7), nullable=True))


def downgrade() -> None:
    op.drop_column("child_notes", "colour")
