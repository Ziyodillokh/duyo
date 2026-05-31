"""Level computation from ball balance (Concept §8.2).

Levels are derived from the cumulative ball balance — there is no stored
level column, so the level can never drift out of sync with the ledger.

    Level 1 Tanish    0
    Level 2 Do'st     100
    Level 3 Sirdosh   500
    Level 4 Hamroh    1500
    Level 5 Hamfikr   5000
    Level 6 Yulduz    15000
"""

from __future__ import annotations

from dataclasses import dataclass

# (level, threshold, name) — ascending by threshold.
_LEVELS: list[tuple[int, int, str]] = [
    (1, 0, "Tanish"),
    (2, 100, "Do'st"),
    (3, 500, "Sirdosh"),
    (4, 1500, "Hamroh"),
    (5, 5000, "Hamfikr"),
    (6, 15000, "Yulduz"),
]

MAX_LEVEL = _LEVELS[-1][0]


@dataclass(frozen=True)
class LevelInfo:
    level: int
    name: str
    balance: int
    current_threshold: int          # balance needed to reach this level
    next_threshold: int | None      # balance for the next level (None at max)
    balls_to_next: int | None       # remaining balls to next level (None at max)


def level_for_balance(balance: int) -> int:
    """Return the level number for a given ball balance."""
    level = 1
    for lvl, threshold, _name in _LEVELS:
        if balance >= threshold:
            level = lvl
        else:
            break
    return level


def level_info(balance: int) -> LevelInfo:
    """Full level breakdown for a balance — used by the API response."""
    balance = max(balance, 0)
    current = _LEVELS[0]
    nxt: tuple[int, int, str] | None = None
    for i, entry in enumerate(_LEVELS):
        if balance >= entry[1]:
            current = entry
            nxt = _LEVELS[i + 1] if i + 1 < len(_LEVELS) else None
        else:
            break
    lvl, threshold, name = current
    next_threshold = nxt[1] if nxt else None
    balls_to_next = (next_threshold - balance) if next_threshold is not None else None
    return LevelInfo(
        level=lvl,
        name=name,
        balance=balance,
        current_threshold=threshold,
        next_threshold=next_threshold,
        balls_to_next=balls_to_next,
    )
