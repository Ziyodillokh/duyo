"""Mark which messages came from a voice turn, so voice can have its own quota.

Voice is about to open up on the free plan with a daily ceiling, and a ceiling
needs something to count. Until now a voice turn and a typed turn were the same
row: `messages` records role, content and crisis level, and nothing that says
how the words arrived.

Counting them apart mattered enough to be explicit rather than inferred. The
one discriminator already present — voice leaves `model` NULL while the text
path fills it — is an accident of two code paths, not a statement, and a
billing ceiling that rests on an accident breaks the first time someone sets
`model` on the voice path for a good reason.

NULL means "typed", which is what every existing row is for counting purposes.
Rows written before this migration are voice turns that will not be counted;
that is deliberate — the quota starts clean rather than retroactively spending
somebody's first day.

Not an enum. A new modality (a video note, a dictated goal) should not need a
type migration to be recorded, and this column is read by one query.

No index. The quota query already narrows by parent and by day through
`conversations → child_profiles` before it looks at this column, and the row
count inside one parent-day is tiny. Add one when that stops being true.

Revision ID: 0045_message_modality
Revises: 0044_goal_catalog_age_floor
"""

import sqlalchemy as sa
from alembic import op

revision = "0045_message_modality"
down_revision = "0044_goal_catalog_age_floor"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "messages",
        sa.Column("modality", sa.String(length=16), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("messages", "modality")
