"""note_source += 'chat_topic': knowledge notes DUYO grows from conversation

When a chat turn carries a real learning topic, DUYO writes (or enriches) a
topic note in the child's brain map (services/topic_notes.py). Those notes
need their own source value because they are the only kind DUYO is allowed
to edit later — a child's `manual` notes are never touched, and `goal_path`
steps are written once.

Revision ID: 0032_note_chat_topic
Revises: 0031_note_goal_path
"""

from __future__ import annotations

from alembic import op

revision: str = "0032_note_chat_topic"
down_revision: str | None = "0031_note_goal_path"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    # PG >= 12 allows ADD VALUE inside a transaction as long as the new value
    # is not USED in the same transaction — and this migration only adds it.
    op.execute("ALTER TYPE note_source ADD VALUE IF NOT EXISTS 'chat_topic'")


def downgrade() -> None:
    # Postgres cannot drop a value from an enum without rewriting the type
    # and every column using it. Rows with source='chat_topic' would block
    # that anyway; leaving the value in place is harmless.
    pass
