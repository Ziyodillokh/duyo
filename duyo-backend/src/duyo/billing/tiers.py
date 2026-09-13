"""Subscription tier catalogue and limits (Concept §12.1).

Tiers and their limits live in code, not the DB — they are product config,
versioned with the app. The DB only stores which tier a user is on.

    free      Tanish    0 so'm        scripted only, 20 msg/day, 1 language
    premium   Hamroh    30 000 /oy    AI, voice, all content, 100 msg/day

There is ONE paid tier. There were two — Do'st at 29 000 without voice and
Hamroh at 59 000 with it — and the split asked a thirteen-year-old to price
their own use of a feature they had not tried. Voice is the thing that makes
this product what it is, so it belongs in the only plan there is.

The daily limit is the one that is actually ENFORCED. `ai_turns_per_day` sat in
this table and read convincingly, but nothing anywhere checked it — only
`daily_message_limit` reaches `billing/limits.py`. A hundred messages a day is
not a wall a real child meets; it is a bound on what one account can cost.
"""

from __future__ import annotations

from dataclasses import dataclass, field

FREE = "free"
PREMIUM = "premium"

#: Retired, and kept as a name only so an existing subscriber's stored tier
#: string still resolves. `get_tier("standart")` answers with the current paid
#: plan rather than None, which would read as "no subscription" to every caller
#: and silently downgrade someone who has paid.
STANDART = "standart"

PAID_TIERS = (PREMIUM,)

#: Spoken turns a free account gets per UTC day.
#:
#: Chosen to be a real trial rather than a teaser: ten turns is a genuine
#: conversation, enough to learn whether talking to DUYO is worth paying for,
#: and it renews every day. It is deliberately not enough to replace the paid
#: plan, because a live session is the most expensive call this product makes.
#:
#: One number, read by the tier table below and printed in the plan's feature
#: list from the same constant, so the wall a child meets and the sentence
#: advertising it cannot drift apart.
FREE_DAILY_VOICE_TURNS = 10


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
    #: Spoken turns per UTC day. None = unlimited, and only meaningful when
    #: `voice` is True. Enforced in billing/limits.py against messages stamped
    #: MODALITY_VOICE, the same way the message ceiling is counted.
    daily_voice_turns: int | None
    max_children: int
    features: list[str] = field(default_factory=list)


# These two lists are what the paywall in the app and the pricing section on
# the site both render, so every line has to be something the server actually
# does. Four of them were not: free was sold as "scripted javoblar" while it
# received the full Gemini model, and paid was sold on "3 til", "barcha
# kontent" and "to'liq gamifikatsiya", none of which any endpoint checks.
# `languages` and `ai_turns_per_day` are still on the dataclass and still
# unenforced — they are not advertised any more, which is the part that
# mattered.
#
# What genuinely separates the plans: the daily message ceiling, and voice.
_TIERS: dict[str, Tier] = {
    FREE: Tier(
        key=FREE, name="Tanish", price_monthly=0, price_yearly=0,
        daily_message_limit=20, ai_turns_per_day=0, languages=1,
        # Voice used to be off here entirely, and a child could not tell what
        # they were being asked to pay for. A few spoken turns a day is enough
        # to find that out; it is not enough to live on, which is what the
        # paid plan is still for.
        voice=True, daily_voice_turns=FREE_DAILY_VOICE_TURNS, max_children=1,
        features=[
            "Kuniga 20 xabar",
            "Matnli suhbat",
            f"Kuniga {FREE_DAILY_VOICE_TURNS} ta ovozli savol",
            "Kutubxona, she'rlar va ertaklar",
            "Maqsadlar va tengdoshlar bilan suhbat",
        ],
    ),
    PREMIUM: Tier(
        key=PREMIUM, name="Hamroh", price_monthly=30_000, price_yearly=300_000,
        daily_message_limit=100, ai_turns_per_day=100, languages=3,
        voice=True, daily_voice_turns=None, max_children=1,
        features=[
            "Kuniga 100 xabar",
            "Cheksiz ovozli suhbat",
            "Bepul rejadagi hamma narsa",
        ],
    ),
}


def all_tiers() -> list[Tier]:
    """Catalogue order: free → premium."""
    return [_TIERS[FREE], _TIERS[PREMIUM]]


def get_tier(key: str) -> Tier | None:
    """A retired tier key resolves to the plan that replaced it.

    Someone is on "standart" right now. Answering None would read as "not
    subscribed" everywhere it is checked and take away what they paid for.
    """
    if key == STANDART:
        return _TIERS[PREMIUM]
    return _TIERS.get(key)


def is_paid(key: str) -> bool:
    """True for the current paid plan AND for the retired key someone holds.

    `PAID_TIERS` is what a NEW checkout may ask for; this is what an EXISTING
    subscription counts as. Answering False for "standart" would revoke voice
    and the raised message limit from anyone who paid before the merge — the
    same reason get_tier maps it forward.
    """
    return key in PAID_TIERS or key == STANDART
