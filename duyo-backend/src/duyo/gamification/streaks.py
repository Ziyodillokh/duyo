"""Pure streak-advancement logic (Concept §8.4).

Separated from the endpoint so the day-math is unit-testable without a DB.
A broken streak resets quietly to 1 — no guilt (Concept §8.4).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta


@dataclass(frozen=True)
class StreakAdvance:
    current_streak: int
    changed: bool  # False when it's a same-day repeat check-in (no-op)


def next_streak(current_streak: int, last_active: date | None, today: date) -> StreakAdvance:
    """Compute the streak after a check-in on `today`.

    - same day as last check-in → unchanged (changed=False)
    - exactly the next day      → +1
    - first ever, or a gap      → reset to 1
    """
    if last_active == today:
        return StreakAdvance(current_streak=current_streak, changed=False)
    if last_active == today - timedelta(days=1):
        return StreakAdvance(current_streak=current_streak + 1, changed=True)
    return StreakAdvance(current_streak=1, changed=True)
