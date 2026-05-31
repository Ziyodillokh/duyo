"""Pure decay/restore logic tests (Concept §4.1, §4.2)."""

import pytest

from duyo.gamification.tamagochi import DECAY_PER_DAY, Metrics, decay, restore

_DAY = 86_400
_FULL = Metrics(100, 100, 100, 100)


def test_one_day_decay_matches_rates():
    d = decay(_FULL, _DAY)
    assert d.energy == 100 - DECAY_PER_DAY["energy"]      # 90
    assert d.joy == 100 - DECAY_PER_DAY["joy"]            # 92
    assert d.learning == 100 - DECAY_PER_DAY["learning"]  # 95
    assert d.health == 100 - DECAY_PER_DAY["health"]      # 97


def test_half_day_is_proportional():
    d = decay(_FULL, _DAY // 2)
    assert d.energy == 95  # 100 - 10*0.5
    assert d.joy == 96     # 100 - 8*0.5


def test_duyo_never_dies_floor_at_zero():
    # 20 days: every rate * 20 exceeds 100 except none should go below 0
    d = decay(_FULL, _DAY * 20)
    assert d.energy == 0
    assert d.joy == 0
    assert d.learning == 0
    assert d.health == 40  # 100 - 3*20


def test_zero_and_negative_elapsed_unchanged():
    assert decay(_FULL, 0) == _FULL
    assert decay(_FULL, -100) == _FULL


def test_restore_adds_and_clamps():
    r = restore(Metrics(95, 50, 50, 50), {"energy": 20, "joy": 10})
    assert r.energy == 100  # clamped
    assert r.joy == 60
    assert r.learning == 50  # untouched


def test_restore_ignores_unknown_keys():
    r = restore(_FULL, {"nonsense": 50})
    assert r == _FULL


@pytest.mark.parametrize("metric", ["energy", "joy", "learning", "health"])
def test_each_metric_decays_independently(metric):
    d = decay(_FULL, _DAY)
    assert d.as_dict()[metric] == 100 - DECAY_PER_DAY[metric]
