"""Tamagochi decay + restore logic (Concept §4) — pure, DB-free, testable.

Daily decay rates (§4.1):
    energy   -10/day
    learning -5/day
    joy      -8/day
    health   -3/day

Decay is proportional to elapsed time (fractional days), applied lazily from
`last_decay_at`. DUYO never dies (§4.2): every metric clamps to [0, 100].
"""

from __future__ import annotations

from dataclasses import dataclass

# Per-day decay rates per metric (Concept §4.1).
DECAY_PER_DAY: dict[str, int] = {
    "energy": 10,
    "learning": 5,
    "joy": 8,
    "health": 3,
}

_SECONDS_PER_DAY = 86_400
_METRICS = ("energy", "joy", "learning", "health")


def _clamp(v: float) -> int:
    """Clamp to the valid 0-100 integer range (DUYO never dies → floor 0)."""
    return max(0, min(100, int(round(v))))


@dataclass(frozen=True)
class Metrics:
    energy: int
    joy: int
    learning: int
    health: int

    def as_dict(self) -> dict[str, int]:
        return {
            "energy": self.energy,
            "joy": self.joy,
            "learning": self.learning,
            "health": self.health,
        }


def decay(current: Metrics, elapsed_seconds: float) -> Metrics:
    """Apply time-proportional decay. Negative/zero elapsed → unchanged."""
    if elapsed_seconds <= 0:
        return current
    days = elapsed_seconds / _SECONDS_PER_DAY
    return Metrics(
        energy=_clamp(current.energy - DECAY_PER_DAY["energy"] * days),
        joy=_clamp(current.joy - DECAY_PER_DAY["joy"] * days),
        learning=_clamp(current.learning - DECAY_PER_DAY["learning"] * days),
        health=_clamp(current.health - DECAY_PER_DAY["health"] * days),
    )


def restore(current: Metrics, boosts: dict[str, int]) -> Metrics:
    """Add boosts to metrics, clamped to 100. Unknown keys are ignored."""
    values = current.as_dict()
    for key in _METRICS:
        if key in boosts:
            values[key] = _clamp(values[key] + boosts[key])
    return Metrics(**values)
