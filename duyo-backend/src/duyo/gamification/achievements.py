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


# How rare each badge is, ascending. This is what decides the ONE badge that
# stands beside a name in Maqsaddoshlar: the rarest the child has earned.
#
# It is a separate table from _CATALOG because _CATALOG is in reading order
# (the order the achievements page lists them) and rarity is not the same
# sequence — a 7-day streak is rarer than reaching level 2, but reads later.
_RANK: dict[str, int] = {
    "first_chat": 1,
    "streak_3": 2,
    "curious": 3,
    "level_up": 4,
    "explorer": 5,
    "streak_7": 6,
    "duyo_dust": 7,
}


def top_badge(achievements: list[Achievement]) -> str | None:
    """The key of the rarest earned badge, or None if none are earned.

    None is deliberate and is not the same as a default badge. A mark beside
    every name marks nobody; the slot beside an unbadged child stays empty.
    """
    best: tuple[int, str] | None = None
    for a in achievements:
        if not a.earned:
            continue
        rank = _RANK.get(a.key, 0)
        if best is None or rank > best[0]:
            best = (rank, a.key)
    return best[1] if best else None
