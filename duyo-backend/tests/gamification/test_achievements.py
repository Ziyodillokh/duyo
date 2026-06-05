"""Achievement badge computation (pure, no DB)."""

from duyo.gamification.achievements import compute_achievements


def _earned(level, longest_streak, message_count):
    return {
        a.key for a in compute_achievements(
            level=level, longest_streak=longest_streak, message_count=message_count
        ) if a.earned
    }


def test_new_child_has_no_badges():
    assert _earned(level=1, longest_streak=0, message_count=0) == set()


def test_first_message_unlocks_first_chat():
    assert "first_chat" in _earned(level=1, longest_streak=0, message_count=1)


def test_message_thresholds():
    e = _earned(level=1, longest_streak=0, message_count=50)
    assert {"first_chat", "curious", "explorer"} <= e


def test_streak_and_level_badges():
    e = _earned(level=3, longest_streak=7, message_count=5)
    assert {"streak_3", "streak_7", "level_up", "duyo_dust"} <= e


def test_catalogue_is_complete_and_stable():
    items = compute_achievements(level=1, longest_streak=0, message_count=0)
    assert len(items) == 7
    assert all(a.name and a.emoji for a in items)
