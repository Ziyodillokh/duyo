"""Subscription tier catalogue and limits (Concept §12.1).

Tiers and their limits live in code, not the DB — they are product config,
versioned with the app. The DB only stores which tier a user is on.

    free      Tanish    0 so'm        scripted only, 20 msg/day, 1 language
    standart  Do'st     29 000 /oy    AI 30 turn/day, all content, 3 languages
    premium   Hamroh    59 000 /oy    AI fair-use, voice, 2 children, priority
"""

from __future__ import annotations

from dataclasses import dataclass, field

FREE = "free"
STANDART = "standart"
PREMIUM = "premium"

# Paid tiers that the mock subscribe flow accepts.
PAID_TIERS = (STANDART, PREMIUM)


@dataclass(frozen=True)
class Tier:
    key: str
    name: str               # brand name (Concept §8.2 / §12.1)
    price_monthly: int      # UZS, 0 for free
    price_yearly: int       # UZS, 0 for free
    daily_message_limit: int | None   # None = unlimited
    ai_turns_per_day: int             # 0 = scripted only
    languages: int
    voice: bool
    max_children: int
    features: list[str] = field(default_factory=list)


_TIERS: dict[str, Tier] = {
    FREE: Tier(
        key=FREE, name="Tanish", price_monthly=0, price_yearly=0,
        daily_message_limit=20, ai_turns_per_day=0, languages=1,
        voice=False, max_children=1,
        features=["20 xabar/kun", "1 til", "Scripted javoblar", "20 she'r"],
    ),
    STANDART: Tier(
        key=STANDART, name="Do'st", price_monthly=29_000, price_yearly=290_000,
        daily_message_limit=None, ai_turns_per_day=30, languages=3,
        voice=False, max_children=1,
        features=["AI 30 turn/kun", "3 til", "Barcha kontent", "To'liq gamifikatsiya"],
    ),
    PREMIUM: Tier(
        key=PREMIUM, name="Hamroh", price_monthly=59_000, price_yearly=590_000,
        daily_message_limit=None, ai_turns_per_day=100, languages=3,
        voice=True, max_children=2,
        features=["AI fair-use", "Ovozli suhbat", "2 bola", "Premium kontent", "Tungi rejim"],
    ),
}


def all_tiers() -> list[Tier]:
    """Catalogue order: free → standart → premium."""
    return [_TIERS[FREE], _TIERS[STANDART], _TIERS[PREMIUM]]


def get_tier(key: str) -> Tier | None:
    return _TIERS.get(key)


def is_paid(key: str) -> bool:
    return key in PAID_TIERS
