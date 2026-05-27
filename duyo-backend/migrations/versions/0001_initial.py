"""initial schema: users, child_profiles, conversations, messages, crisis_events

Revision ID: 0001_initial
Revises:
Create Date: 2026-05-27
"""

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ENUM types
    op.execute("CREATE TYPE age_segment AS ENUM ('junior','explorer','companion')")
    op.execute("CREATE TYPE language AS ENUM ('uz','ru','en')")
    op.execute("CREATE TYPE message_role AS ENUM ('child','assistant','system')")
    op.execute("CREATE TYPE crisis_level AS ENUM ('GREEN','YELLOW','ORANGE','RED')")

    # users
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("phone", sa.String(20), nullable=False),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("phone", name="uq_users_phone"),
    )
    op.create_index("ix_users_phone", "users", ["phone"], unique=True)

    # child_profiles
    op.create_table(
        "child_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("parent_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(80), nullable=False),
        sa.Column("age", sa.Integer, nullable=False),
        sa.Column("age_segment", postgresql.ENUM(name="age_segment", create_type=False), nullable=False),
        sa.Column("language", postgresql.ENUM(name="language", create_type=False), nullable=False, server_default="uz"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("age >= 7 AND age <= 16", name="ck_child_age_range"),
    )
    op.create_index("ix_child_profiles_parent_id", "child_profiles", ["parent_id"])

    # conversations
    op.create_table(
        "conversations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("child_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("child_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("message_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_conversations_child_id", "conversations", ["child_id"])

    # messages
    op.create_table(
        "messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("conversation_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", postgresql.ENUM(name="message_role", create_type=False), nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("model", sa.String(80), nullable=True),
        sa.Column("latency_ms", sa.Integer, nullable=True),
        sa.Column("tokens_in", sa.Integer, nullable=True),
        sa.Column("tokens_out", sa.Integer, nullable=True),
        sa.Column("crisis_level", postgresql.ENUM(name="crisis_level", create_type=False), nullable=False, server_default="GREEN"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_messages_conversation_id", "messages", ["conversation_id"])

    # crisis_events
    op.create_table(
        "crisis_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("message_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("messages.id", ondelete="SET NULL"), nullable=True),
        sa.Column("child_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("child_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("level", postgresql.ENUM(name="crisis_level", create_type=False), nullable=False),
        sa.Column("layer", sa.Integer, nullable=False),
        sa.Column("matches", postgresql.JSONB, nullable=True),
        sa.Column("parent_notified", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("parent_notified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_crisis_events_message_id", "crisis_events", ["message_id"])
    op.create_index("ix_crisis_events_child_id", "crisis_events", ["child_id"])


def downgrade() -> None:
    op.drop_index("ix_crisis_events_child_id", "crisis_events")
    op.drop_index("ix_crisis_events_message_id", "crisis_events")
    op.drop_table("crisis_events")
    op.drop_index("ix_messages_conversation_id", "messages")
    op.drop_table("messages")
    op.drop_index("ix_conversations_child_id", "conversations")
    op.drop_table("conversations")
    op.drop_index("ix_child_profiles_parent_id", "child_profiles")
    op.drop_table("child_profiles")
    op.drop_index("ix_users_phone", "users")
    op.drop_table("users")
    op.execute("DROP TYPE IF EXISTS crisis_level")
    op.execute("DROP TYPE IF EXISTS message_role")
    op.execute("DROP TYPE IF EXISTS language")
    op.execute("DROP TYPE IF EXISTS age_segment")
