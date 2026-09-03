"""The over-limit notice sells nothing and exists in all three languages.

The string it replaced told a blocked child to renew a subscription. There is
no purchase path in the app, so that sentence was steering a 13-year-old at a
product they cannot buy — and it was Uzbek only, shown unchanged to Russian and
English speakers.
"""

from __future__ import annotations

from duyo.models.child import Language
from duyo.services.limit_notice import daily_limit_message

# Anything that reads as "pay us" in any of the three languages.
_PURCHASE_WORDS = (
    "obuna", "tarif", "sotib", "to'lov", "pullik",
    "подпис", "тариф", "оплат", "купить", "платн",
    "subscri", "upgrade", "plan", "premium", "buy", "pay",
)


def test_every_language_has_its_own_notice():
    seen = set()
    for language in (Language.UZ, Language.RU, Language.EN):
        text = daily_limit_message(language, used=20, limit=20)
        assert len(text) > 30
        seen.add(text)
    assert len(seen) == 3


def test_the_notice_never_asks_a_child_to_buy_anything():
    for language in (Language.UZ, Language.RU, Language.EN, None):
        lowered = daily_limit_message(language, used=20, limit=20).lower()
        for word in _PURCHASE_WORDS:
            assert word not in lowered, f"{language}: {word}"


def test_the_notice_states_the_limit_and_when_it_resets():
    for language in (Language.UZ, Language.RU, Language.EN):
        text = daily_limit_message(language, used=20, limit=20)
        assert "20/20" in text
        # billing/limits.py counts from UTC midnight; Tashkent is UTC+5.
        assert "05:00" in text


def test_an_unknown_language_falls_back_to_uzbek():
    assert daily_limit_message(None, used=20, limit=20) == daily_limit_message(
        Language.UZ, used=20, limit=20
    )


def test_an_unlimited_tier_never_prints_none_at_a_child():
    text = daily_limit_message(Language.UZ, used=41, limit=None)
    assert "None" not in text
    assert "41/41" in text
