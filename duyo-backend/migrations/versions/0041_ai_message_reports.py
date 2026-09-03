"""A queue for reports about DUYO's own replies.

`message_feedback` already existed, but a 👎 labelled "didn't like this answer"
is a preference signal. Google Play requires apps that declare a generative-AI
feature to give the user a way to report OFFENSIVE generated content, and to
act on what comes in. That is a different question, so it is a different table
rather than another column on the ratings one.

`model_output` duplicates `messages.content` on purpose: `message_id` is SET
NULL, so deleting the conversation leaves the report standing with the words
still in it. Without the copy, a child could file a report and erase its
evidence in the same minute.

Revision ID: 0041_ai_message_reports
Revises: 0040_peer_report_group_message
"""

import sqlalchemy as sa
from alembic import op

revision: str = "0041_ai_message_reports"
down_revision: str | None = "0040_peer_report_group_message"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.create_table(
        "ai_message_reports",
        sa.Column(
            "id",
            sa.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "message_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("messages.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "child_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("child_profiles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        # Plain text, not a PG enum: the reason set is validated at the API
        # boundary, and a sixth reason should be a deploy, not a type change.
        sa.Column("reason", sa.String(40), nullable=False),
        sa.Column("model_output", sa.Text(), nullable=False),
        sa.Column("model_name", sa.String(120), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reviewed_by", sa.String(255), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint(
            "message_id", "child_id", name="uq_ai_report_message_child"
        ),
    )
    op.create_index(
        "ix_ai_message_reports_message_id", "ai_message_reports", ["message_id"]
    )
    op.create_index(
        "ix_ai_message_reports_child_id", "ai_message_reports", ["child_id"]
    )
    # The reviewer's only query is "what is still untriaged, newest first".
    op.create_index(
        "ix_ai_message_reports_reviewed_at", "ai_message_reports", ["reviewed_at"]
    )


def downgrade() -> None:
    op.drop_index("ix_ai_message_reports_reviewed_at", table_name="ai_message_reports")
    op.drop_index("ix_ai_message_reports_child_id", table_name="ai_message_reports")
    op.drop_index("ix_ai_message_reports_message_id", table_name="ai_message_reports")
    op.drop_table("ai_message_reports")
