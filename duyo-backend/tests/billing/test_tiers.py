"""Tier catalogue tests (Concept §12.1)."""

from duyo.billing import tiers


def test_catalogue_order():
    keys = [t.key for t in tiers.all_tiers()]
    assert keys == [tiers.FREE, tiers.STANDART, tiers.PREMIUM]


def test_free_tier_limits():
    free = tiers.get_tier(tiers.FREE)
    assert free.price_monthly == 0
    assert free.ai_turns_per_day == 0  # scripted only
    assert free.daily_message_limit == 20
    assert free.voice is False


def test_premium_unlocks_voice_and_two_children():
    prem = tiers.get_tier(tiers.PREMIUM)
    assert prem.voice is True
    assert prem.max_children == 2
    assert prem.price_monthly == 59_000
    assert prem.price_yearly == 590_000


def test_is_paid():
    assert tiers.is_paid(tiers.STANDART) is True
    assert tiers.is_paid(tiers.PREMIUM) is True
    assert tiers.is_paid(tiers.FREE) is False


def test_get_unknown_tier_is_none():
    assert tiers.get_tier("platinum") is None
