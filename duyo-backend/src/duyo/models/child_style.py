"""ChildStyleProfile — how DUYO should TALK to this child, learned over time.

Companion piece to `models/goal.py` (WHAT the child is working toward). This
table is WHO the child seems to be as a conversation partner: reply length
they respond well to, how much humor lands, whether they need encouragement,
recurring interests, and topics they steer away from.

Deliberately evidence-based, never a single-message flip: every extraction
adds a vote to a counter (`services/style_profile.py` does the merging), and
`personalization.py` only surfaces a trait once enough votes agree. One bad
or sarcastic message must not repaint how DUYO treats a child for the rest of
the relationship — the same reasoning `child_goals` applies via
`confirmed_at`, applied here as "wait for a pattern" instead of "wait for a
yes".

Explicitly NOT clinical: this is tone/interest adaptation only (see
`services/style_profile.py` module docstring). It must never grow into a
personality/diagnosis label — `duyo-docs/HOLAT-2026-08-01.md` already flags
`psychology/taxonomy.py` as clinically unvalidated, and this table must not
become a second, unreviewed version of the same problem.

One row per child (unique `child_id`), updated in place — mirrors
`ChildSocialSettings` / `TamagochiState`, not the append-only
`child_goal_events` log, because there is no "history of style" a human ever
needs to review turn-by-turn, only the current best guess.
"""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import ForeignKey, Integer
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from duyo.models.base import UUIDPK, Base, TimestampMixin


class ChildStyleProfile(Base, UUIDPK, TimestampMixin):
    __tablename__ = "child_style_profiles"

    child_id: Mapped[UUID] = mapped_column(
        ForeignKey("child_profiles.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

    # Vote counters, e.g. {"short": 5, "medium": 1} — the dominant key is the
    # current guess. Never a single overwritten value: see module docstring.
    # Keys are fixed vocabularies enforced in services/style_profile.py, not
    # here, so this model stays a plain, dumb store.
    length_votes: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    humor_votes: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    encouragement_votes: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    # tag -> how many conversations mentioned it. Free-form (child-topic
    # vocabulary can't be enumerated up front), but never raw sentences —
    # only short topic tags the extractor produces, same shape as
    # `analysis/reports.py` topics.
    interests: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    avoid_topics: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    # Total extraction merges applied, regardless of whether they changed
    # anything — the confidence gate `personalization.py` uses before it
    # trusts length/humor/encouragement enough to mention them.
    evidence_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    def __repr__(self) -> str:
        return f"<ChildStyleProfile child={self.child_id} evidence={self.evidence_count}>"
