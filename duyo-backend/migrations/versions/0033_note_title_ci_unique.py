"""child_notes: title uniqueness becomes case-insensitive

Everything that RESOLVES a title already ignores case — [[link]] resolution
in build_graph casefolds, and capture_topic looks up lower(title) — but the
unique constraint was exact, so "Kosmos" and "kosmos" could both exist. Two
notes one link can reach is an ambiguity every reader of the graph then
inherits. The constraint now matches the resolvers.

Any case-variant duplicates that already exist are suffixed " (2)", " (3)"…
(keeping the oldest row's title untouched) before the index is created —
without that the index build would fail on the very data it exists to
prevent. create_note/update_note already turn the resulting IntegrityError
into a 409, so no endpoint changes.

Revision ID: 0033_note_title_ci_unique
Revises: 0032_note_chat_topic
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision: str = "0033_note_title_ci_unique"
down_revision: str | None = "0032_note_chat_topic"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    # Suffix later case-variant duplicates. left(...,112) leaves room for the
    # suffix inside the 120-char column.
    op.execute(
        """
        WITH ranked AS (
            SELECT id, ROW_NUMBER() OVER (
                PARTITION BY child_id, lower(title)
                ORDER BY created_at, id
            ) AS rn
            FROM child_notes
        )
        UPDATE child_notes n
        SET title = left(n.title, 112) || ' (' || r.rn || ')'
        FROM ranked r
        WHERE n.id = r.id AND r.rn > 1
        """
    )
    op.drop_constraint("uq_note_child_title", "child_notes", type_="unique")
    op.create_index(
        "uq_note_child_title_ci",
        "child_notes",
        ["child_id", sa.text("lower(title)")],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("uq_note_child_title_ci", table_name="child_notes")
    op.create_unique_constraint("uq_note_child_title", "child_notes", ["child_id", "title"])
