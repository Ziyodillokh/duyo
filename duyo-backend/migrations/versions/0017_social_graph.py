"""goal-mates: pseudonymous peer connections and server-relayed messages

Revision ID: 0017_social_graph
Revises: 0016_child_goals
Create Date: 2026-08-01
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0017_social_graph"
down_revision: str | None = "0016_child_goals"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    friendship_status = postgresql.ENUM(
        "pending", "accepted", "declined", "blocked",
        name="friendship_status", create_type=False,
    )
    peer_moderation_state = postgresql.ENUM(
        "delivered", "blocked", "redacted",
        name="peer_moderation_state", create_type=False,
    )
    for enum in (friendship_status, peer_moderation_state):
        enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "child_social_settings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("child_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("child_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("display_name", sa.String(24), nullable=False),
        sa.Column("discoverable", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("suspended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("suspended_by", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("child_id", name="uq_social_settings_child"),
    )
    op.create_index("ix_child_social_settings_child_id", "child_social_settings", ["child_id"])

    op.create_table(
        "friendships",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("child_low_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("child_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("child_high_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("child_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("requested_by_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("child_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", friendship_status, nullable=False, server_default="pending"),
        sa.Column("blocked_by_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("child_profiles.id", ondelete="SET NULL"), nullable=True),
        sa.Column("match_key", sa.String(80), nullable=True),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        # Canonical ordering makes (A,B) and (B,A) structurally impossible.
        sa.CheckConstraint("child_low_id < child_high_id", name="ck_friendship_ordered_pair"),
        sa.UniqueConstraint("child_low_id", "child_high_id", name="uq_friendship_pair"),
    )
    op.create_index("ix_friendships_child_low_id", "friendships", ["child_low_id"])
    op.create_index("ix_friendships_child_high_id", "friendships", ["child_high_id"])

    op.create_table(
        "peer_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("friendship_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("friendships.id", ondelete="CASCADE"), nullable=False),
        # SET NULL: deleting a profile must not erase the other child's thread.
        sa.Column("sender_child_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("child_profiles.id", ondelete="SET NULL"), nullable=True),
        sa.Column("seq", sa.BigInteger, sa.Identity(always=False), nullable=False),
        sa.Column("body", sa.Text, nullable=False),
        sa.Column("moderation_state", peer_moderation_state, nullable=False,
                  server_default="delivered"),
        sa.Column("moderation_reason", sa.String(80), nullable=True),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("seq", name="uq_peer_messages_seq"),
    )
    op.create_index("ix_peer_messages_friendship_id", "peer_messages", ["friendship_id"])
    op.create_index("ix_peer_messages_sender_child_id", "peer_messages", ["sender_child_id"])
    op.create_index("ix_peer_messages_friendship_seq", "peer_messages",
                    ["friendship_id", "seq"])

    op.create_table(
        "peer_reports",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("reporter_child_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("child_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("reported_child_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("child_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("friendship_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("friendships.id", ondelete="SET NULL"), nullable=True),
        sa.Column("reason", sa.String(200), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reviewed_by", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_peer_reports_reporter_child_id", "peer_reports", ["reporter_child_id"])
    op.create_index("ix_peer_reports_reported_child_id", "peer_reports", ["reported_child_id"])
    # Open safety queue: unreviewed first.
    op.create_index("ix_peer_reports_reviewed_at", "peer_reports", ["reviewed_at"])


def downgrade() -> None:
    op.drop_index("ix_peer_reports_reviewed_at", "peer_reports")
    op.drop_index("ix_peer_reports_reported_child_id", "peer_reports")
    op.drop_index("ix_peer_reports_reporter_child_id", "peer_reports")
    op.drop_table("peer_reports")

    op.drop_index("ix_peer_messages_friendship_seq", "peer_messages")
    op.drop_index("ix_peer_messages_sender_child_id", "peer_messages")
    op.drop_index("ix_peer_messages_friendship_id", "peer_messages")
    op.drop_table("peer_messages")

    op.drop_index("ix_friendships_child_high_id", "friendships")
    op.drop_index("ix_friendships_child_low_id", "friendships")
    op.drop_table("friendships")

    op.drop_index("ix_child_social_settings_child_id", "child_social_settings")
    op.drop_table("child_social_settings")

    for name in ("peer_moderation_state", "friendship_status"):
        sa.Enum(name=name).drop(op.get_bind(), checkfirst=True)
