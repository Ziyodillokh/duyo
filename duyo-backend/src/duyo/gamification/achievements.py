"""Achievement badges — computed from existing gamification data (no table).

Like levels, achievements are derived on the fly from the child's current
stats (level, longest streak, message count) so they can never drift out of
sync and need no migration.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Achievement:
    key: str
    name: str
    emoji: str
    earned: bool


# (key, name, emoji, predicate) — predicate takes the stats below.
_CATALOG: list[tuple[str, str, str]] = [
    ("first_chat", "Birinchi suhbat", "🎯"),
    ("curious", "Qiziquvchi", "🧠"),
    ("explorer", "Izlanuvchi", "🚀"),
    ("streak_3", "3 kunlik seriya", "🔥"),
    ("streak_7", "7 kunlik seriya", "⭐"),
    ("level_up", "Daraja oshish", "📈"),
    ("duyo_dust", "DUYO do'sti", "💛"),
]


def compute_achievements(
    *, level: int, longest_streak: int, message_count: int
) -> list[Achievement]:
    """Return the full badge catalogue with each marked earned/not."""
    earned = {
        "first_chat": message_count >= 1,
        "curious": message_count >= 10,
        "explorer": message_count >= 50,
        "streak_3": longest_streak >= 3,
        "streak_7": longest_streak >= 7,
        "level_up": level >= 2,
        "duyo_dust": level >= 3,
    }
    return [
        Achievement(key=k, name=n, emoji=e, earned=earned.get(k, False))
        for k, n, e in _CATALOG
    ]
