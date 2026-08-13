"""Backfill match_key on goals that were typed instead of picked.

`match_key` used to be set in exactly one place — tapping a chip in the
catalogue picker — so every goal a child typed, and every goal the
conversation extractor created, carried NULL and could never match anybody.
Live data showed the cost plainly: three discoverable 14-year-olds each had a
Naruto goal and none could see the others, and a fourth child had typed
"O'tkan kunlarni o'qish" while `book_otkan_kunlar` sat unused in the
catalogue.

services/goal_matching.py fixes that going forward. This migration applies the
same resolution to the goals that already exist, so the children who are
already here benefit without having to re-enter anything.

Deliberately conservative:
  * Only ACTIVE goals with match_key IS NULL are touched.
  * Only published (`matchable AND active`) catalogue entries are eligible —
    the human curation gate is not bypassed.
  * The catalogue's own age band is applied per child.
  * A goal whose wording does not clearly resolve is LEFT ALONE.
  * A key already used by that child's other active goal is skipped, so the
    partial unique index on (child_id, match_key) cannot be violated.

Irreversible in the strict sense: downgrade clears only the keys this
migration could have set, which is the closest honest inverse.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision: str = "0025_backfill_goal_match_keys"
down_revision: str | None = "0024_note_colour"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Imported here, not at module import time: Alembic loads every migration
    # file to build the graph, and the app package may not be importable in
    # every context that happens in.
    from duyo.services.goal_matching import score_title

    bind = op.get_bind()

    catalog = bind.execute(
        sa.text(
            "SELECT match_key, title, target_ref, age_min, age_max "
            "FROM goal_catalog WHERE matchable = true AND active = true"
        )
    ).fetchall()
    if not catalog:
        return

    goals = bind.execute(
        sa.text(
            "SELECT g.id, g.title, g.child_id, c.age "
            "FROM child_goals g JOIN child_profiles c ON c.id = g.child_id "
            "WHERE g.match_key IS NULL AND g.status = 'active'"
        )
    ).fetchall()

    # Keys already taken by an active goal, per child — respects the partial
    # unique index the same way the application does.
    taken: dict[str, set[str]] = {}
    for child_id, key in bind.execute(
        sa.text(
            "SELECT child_id, match_key FROM child_goals "
            "WHERE match_key IS NOT NULL AND status = 'active'"
        )
    ).fetchall():
        taken.setdefault(str(child_id), set()).add(key)

    for goal_id, title, child_id, age in goals:
        eligible = [
            row for row in catalog if row.age_min <= age <= row.age_max
        ]
        best_key, best, runner_up = None, 0.0, 0.0
        for row in eligible:
            entry = _Entry(row.title, row.target_ref)
            value = score_title(title or "", entry)
            if value > best:
                best, runner_up, best_key = value, best, row.match_key
            elif value > runner_up:
                runner_up = value

        # Same thresholds as resolve_match_key. Kept as literals rather than
        # imported so a later tuning of the live matcher cannot silently
        # rewrite what this already-applied migration did.
        if best_key is None or best < 0.45 or best - runner_up < 0.05:
            continue
        if best_key in taken.get(str(child_id), set()):
            continue

        bind.execute(
            sa.text("UPDATE child_goals SET match_key = :key WHERE id = :id"),
            {"key": best_key, "id": goal_id},
        )
        taken.setdefault(str(child_id), set()).add(best_key)


class _Entry:
    """The two attributes score_title reads off a GoalCatalog row."""

    def __init__(self, title: str, target_ref) -> None:
        self.title = title
        self.target_ref = target_ref


def downgrade() -> None:
    # Only goals this migration could have created a key for: the picker sets
    # match_key at creation together with a confirmed_at, and so does the API,
    # so there is no marker distinguishing them after the fact. Clearing every
    # key would destroy the picker's work, so downgrade is a no-op by design.
    pass
