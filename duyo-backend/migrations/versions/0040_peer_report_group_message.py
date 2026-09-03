"""Point a peer report at a group message.

`peer_reports` was shaped for the one-to-one channel: a report carried a
`friendship_id` and the safety queue read the thread behind it. A goal room has
no friendship, so a report filed from a room reached a reviewer as "child A
dislikes child B" with nothing to read — and `/safety/peer-reports/{id}/context`
returns an empty list for exactly that case.

`friendship_id` was already nullable, so only the new column is needed. SET
NULL, not CASCADE: deleting the message must not delete the record that someone
complained about it.

Revision ID: 0040_peer_report_group_message
Revises: 0039_crisis_event_retention
"""

import sqlalchemy as sa
from alembic import op

revision: str = "0040_peer_report_group_message"
down_revision: str | None = "0039_crisis_event_retention"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.add_column(
        "peer_reports",
        sa.Column(
            "group_message_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("group_messages.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("peer_reports", "group_message_id")
