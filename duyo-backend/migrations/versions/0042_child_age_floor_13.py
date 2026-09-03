"""The age floor on child_profiles moves from 7 to 13.

DUYO became a 13+ app in e2ebb05, and AgeSegment.from_age has refused anything
under 13 since. The database did not: `ck_child_age_range` still admitted a
seven-year-old, which is what makes a 13+ store declaration untrue no matter
what the client's age picker renders.

This migration REFUSES TO RUN while rows below 13 exist, rather than deleting
them or widening around them. Those rows are children with conversations,
notes, goals and crisis history; what happens to them is the owner's decision
and a data-protection one, not something a schema change should make silently
at 3am. Clear them first — the count is in the error, and:

    SELECT id, age, created_at FROM child_profiles WHERE age < 13 ORDER BY age;

Revision ID: 0042_child_age_floor_13
Revises: 0041_ai_message_reports
"""

import sqlalchemy as sa
from alembic import op

revision: str = "0042_child_age_floor_13"
down_revision: str | None = "0041_ai_message_reports"
branch_labels: str | None = None
depends_on: str | None = None

_CONSTRAINT = "ck_child_age_range"


def upgrade() -> None:
    conn = op.get_bind()
    under_13 = conn.scalar(
        sa.text("SELECT count(*) FROM child_profiles WHERE age < 13")
    )
    if under_13:
        raise RuntimeError(
            f"{under_13} child_profiles row(s) have age < 13. DUYO is published "
            "as a 13+ app; resolve these accounts before applying "
            "0042_child_age_floor_13."
        )

    op.drop_constraint(_CONSTRAINT, "child_profiles", type_="check")
    op.create_check_constraint(_CONSTRAINT, "child_profiles", "age >= 13 AND age <= 16")


def downgrade() -> None:
    op.drop_constraint(_CONSTRAINT, "child_profiles", type_="check")
    op.create_check_constraint(_CONSTRAINT, "child_profiles", "age >= 7 AND age <= 16")
