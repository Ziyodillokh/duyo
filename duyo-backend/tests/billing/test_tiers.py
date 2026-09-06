"""Tier catalogue tests.

There is one paid tier. The tests that mattered when there were two are the
ones about what happens to somebody who bought the one that no longer exists.
"""

from duyo.billing import tiers


def test_catalogue_order():
    keys = [t.key for t in tiers.all_tiers()]
    assert keys == [tiers.FREE, tiers.PREMIUM]


def test_free_tier_limits():
    free = tiers.get_tier(tiers.FREE)
    assert free.price_monthly == 0
    assert free.ai_turns_per_day == 0  # scripted only
    assert free.daily_message_limit == 20
    assert free.voice is False


def test_the_one_paid_tier():
    prem = tiers.get_tier(tiers.PREMIUM)
    assert prem.voice is True
    assert prem.price_monthly == 30_000
    assert prem.price_yearly == 300_000
    # The limit that is actually enforced — ai_turns_per_day never was.
    assert prem.daily_message_limit == 100


def test_retired_tier_still_resolves_to_the_current_plan():
    """Somebody is on "standart" right now and has paid for it.

    Answering None would read as "no subscription" to every caller, so a
    paying subscriber would silently lose voice and drop to the free limit.
    """
    assert tiers.get_tier(tiers.STANDART) is tiers.get_tier(tiers.PREMIUM)


def test_retired_tier_still_counts_as_paid():
    assert tiers.is_paid(tiers.STANDART) is True
    assert tiers.is_paid(tiers.PREMIUM) is True
    assert tiers.is_paid(tiers.FREE) is False


def test_retired_tier_is_not_offered_for_a_new_purchase():
    """It resolves and it counts as paid — but nobody may buy it again."""
    assert tiers.STANDART not in tiers.PAID_TIERS
    assert [t.key for t in tiers.all_tiers()] == [tiers.FREE, tiers.PREMIUM]


def test_get_unknown_tier_is_none():
    assert tiers.get_tier("platinum") is None
