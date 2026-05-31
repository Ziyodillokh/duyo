"""Level computation tests (Concept §8.2)."""

import pytest

from duyo.gamification.levels import MAX_LEVEL, level_for_balance, level_info


@pytest.mark.parametrize(
    "balance,expected",
    [
        (0, 1), (50, 1), (99, 1),
        (100, 2), (499, 2),
        (500, 3), (1499, 3),
        (1500, 4), (4999, 4),
        (5000, 5), (14999, 5),
        (15000, 6), (99999, 6),
    ],
)
def test_level_for_balance(balance, expected):
    assert level_for_balance(balance) == expected


def test_negative_balance_is_level_1():
    assert level_for_balance(-100) == 1


def test_level_info_mid_level():
    info = level_info(250)
    assert info.level == 2
    assert info.name == "Do'st"
    assert info.current_threshold == 100
    assert info.next_threshold == 500
    assert info.balls_to_next == 250


def test_level_info_at_threshold():
    info = level_info(500)
    assert info.level == 3
    assert info.balls_to_next == 1000  # 1500 - 500


def test_level_info_max_level_has_no_next():
    info = level_info(20000)
    assert info.level == MAX_LEVEL == 6
    assert info.name == "Yulduz"
    assert info.next_threshold is None
    assert info.balls_to_next is None


def test_level_info_clamps_negative():
    info = level_info(-5)
    assert info.level == 1
    assert info.balance == 0
