"""Streak-advancement tests (Concept §8.4)."""

from datetime import date

from duyo.gamification.streaks import next_streak

_TODAY = date(2026, 6, 1)
_YESTERDAY = date(2026, 5, 31)
_TWO_DAYS_AGO = date(2026, 5, 30)


def test_first_ever_checkin_starts_at_1():
    adv = next_streak(current_streak=0, last_active=None, today=_TODAY)
    assert adv.current_streak == 1
    assert adv.changed is True


def test_consecutive_day_increments():
    adv = next_streak(current_streak=4, last_active=_YESTERDAY, today=_TODAY)
    assert adv.current_streak == 5
    assert adv.changed is True


def test_same_day_is_noop():
    adv = next_streak(current_streak=4, last_active=_TODAY, today=_TODAY)
    assert adv.current_streak == 4
    assert adv.changed is False


def test_gap_resets_to_1():
    adv = next_streak(current_streak=10, last_active=_TWO_DAYS_AGO, today=_TODAY)
    assert adv.current_streak == 1
    assert adv.changed is True
