"""Clear the length votes, because the rule that produced them was wrong.

`length_pref` was extracted from how long the CHILD's message was: one to three
words voted "short". After two such votes — and `CONFIDENCE_FLOOR` is 2 — every
subsequent system prompt carried "Bola qisqa javoblarni afzal ko'radi —
javoblaringni ixcham tut." permanently. Votes were never decayed and never
reset, so the instruction only ever accumulated.

That inference does not hold. "Fotosintez nima?" is three words and is a
request for an explanation, not for brevity. Voice transcripts made it worse:
"ha", "zo'r", "tushundim" are the shape of ordinary speech, and each one voted
to make DUYO terser. The result is an assistant that measurably gets shorter
the more a child talks to it — which is the complaint that led here.

The extractor now only records a length preference when the child ASKS for one.
The votes already in the table were collected under the old rule, so they are
cleared rather than left to keep applying a preference nobody expressed.

Only `length_votes` is touched. Humour, encouragement and interests are
inferred from what the child actually did, not from how much they typed, and
they stay.

Revision ID: 0043_reset_length_votes
Revises: 0042_child_age_floor_13
"""

from alembic import op

revision = "0043_reset_length_votes"
down_revision = "0042_child_age_floor_13"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("UPDATE child_style_profiles SET length_votes = '{}'::jsonb")


def downgrade() -> None:
    """Not reversible, and it should not pretend to be.

    The votes are gone; restoring them would mean re-deriving a preference from
    message lengths, which is the bug. A downgrade leaves the column empty and
    the profile simply expresses no length preference — which is the correct
    state for a child who never asked for one.
    """
