"""family_invites: expiry + decline, so a link needs the invitee's consent

An invite used to be claimed automatically on the invitee's next OTP verify.
`child_phone` is an arbitrary number typed by whoever is inviting, so that
made any account able to become the recorded "parent" of a stranger's
profile — reading their chat history and safety reports, and receiving the
crisis alerts meant for the real parent — with nothing shown to the victim
but an ordinary-looking login SMS. A mistyped digit did the same by accident.

Claiming now requires an explicit accept from the invited account, so an
offer additionally needs a lifetime and a way to be refused.

Existing rows: `expires_at` is backfilled to created_at + 24h, which is in
the past for every row written before this migration. That is deliberate —
those invites were created under the silent-claim rule and were never
consented to, so they must not remain claimable.

Revision ID: 0030_family_invite_consent
Revises: 0029_family_invites
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision: str = "0030_family_invite_consent"
down_revision: str | None = "0029_family_invites"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.add_column(
        "family_invites",
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "family_invites",
        sa.Column("declined_at", sa.DateTime(timezone=True), nullable=True),
    )
    # Backfill before NOT NULL. Pre-consent invites land in the past on
    # purpose (see the note above) — they are offers nobody agreed to.
    op.execute(
        "UPDATE family_invites "
        "SET expires_at = created_at + INTERVAL '24 hours' "
        "WHERE expires_at IS NULL"
    )
    op.alter_column("family_invites", "expires_at", nullable=False)

    # The open-offer lookup: "is anyone waiting on this phone right now".
    op.create_index(
        "ix_family_invites_open",
        "family_invites",
        ["child_phone"],
        unique=False,
        postgresql_where=sa.text("claimed = false AND declined_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index("ix_family_invites_open", table_name="family_invites")
    op.drop_column("family_invites", "declined_at")
    op.drop_column("family_invites", "expires_at")
