"""crisis_events survive the account they came from, de-identified.

child_id was NOT NULL with ON DELETE CASCADE, so erasing a family also erased
seven years of safety audit trail — the one record the product is required to
keep. Nullable + ON DELETE SET NULL keeps the detection (level, layer, matched
keywords, timestamps) and drops the person: message_id was already SET NULL
and the message itself goes with the account.

A null child_id therefore means "this family deleted their account", and
nothing else. See services/account_deletion.py.

Revision ID: 0039_crisis_event_retention
Revises: 0038_user_token_version
"""

import sqlalchemy as sa
from alembic import op

revision: str = "0039_crisis_event_retention"
down_revision: str | None = "0038_user_token_version"
branch_labels: str | None = None
depends_on: str | None = None

_FK = "crisis_events_child_id_fkey"


def upgrade() -> None:
    op.alter_column("crisis_events", "child_id", existing_type=sa.UUID(), nullable=True)
    op.drop_constraint(_FK, "crisis_events", type_="foreignkey")
    op.create_foreign_key(
        _FK, "crisis_events", "child_profiles", ["child_id"], ["id"], ondelete="SET NULL",
    )


def downgrade() -> None:
    # Rows de-identified while this was live have no child to point back at,
    # so restoring NOT NULL would fail on them. They are deleted: a downgrade
    # that keeps them would have to invent a child_id, and the alternative is
    # a migration that cannot run at all.
    op.execute(sa.text("DELETE FROM crisis_events WHERE child_id IS NULL"))
    op.drop_constraint(_FK, "crisis_events", type_="foreignkey")
    op.create_foreign_key(
        _FK, "crisis_events", "child_profiles", ["child_id"], ["id"], ondelete="CASCADE",
    )
    op.alter_column("crisis_events", "child_id", existing_type=sa.UUID(), nullable=False)
