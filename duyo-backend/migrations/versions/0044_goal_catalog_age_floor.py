"""Raise the goal catalogue's age floor to 13, because the UI prints it.

`goal_catalog.age_min` defaulted to 7, from when DUYO served 7-16 year olds.
The rows kept that value after the app became 13+, and the group screen renders
the range verbatim — so a room in a 13+ app was labelled "7-16 yosh". A Play
reviewer weighing whether an app appeals to under-13s reads that as the app
saying it serves seven-year-olds, and it contradicts the age floor the schema
now enforces on child_profiles (0042).

Safe for matching. `age_min` is only ever used as `age_min <= child.age`
(api/v1/goals.py, services/goal_matching.py), and every child is now at least
13, so raising the floor from 7 to 13 excludes nothing that was matching
before.

`age_max` is untouched: 16 is the real ceiling.

Revision ID: 0044_goal_catalog_age_floor
Revises: 0043_reset_length_votes
"""

import sqlalchemy as sa
from alembic import op

revision = "0044_goal_catalog_age_floor"
down_revision = "0043_reset_length_votes"
branch_labels = None
depends_on = None

FLOOR = 13


def upgrade() -> None:
    op.execute(f"UPDATE goal_catalog SET age_min = {FLOOR} WHERE age_min < {FLOOR}")
    op.alter_column(
        "goal_catalog", "age_min",
        existing_type=sa.Integer(),
        server_default=str(FLOOR),
        existing_nullable=False,
    )


def downgrade() -> None:
    """The default goes back; the rows do not.

    Which rows were originally below 13 is not recorded anywhere, and guessing
    would re-label rooms in a 13+ app with a range that was wrong to begin with.
    """
    op.alter_column(
        "goal_catalog", "age_min",
        existing_type=sa.Integer(),
        server_default="7",
        existing_nullable=False,
    )
