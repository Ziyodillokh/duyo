"""System-prompt guards.

The companion persona (COMPANION_STYLE_RULE) deliberately borrows the warm,
remembering, emotionally-attuned traits of adult companion apps WITHOUT their
parasocial core. These tests pin the safety boundary so a future prompt edit
can't quietly drop it.
"""

from duyo.models.child import AgeSegment
from duyo.prompts import COMPANION_STYLE_RULE, STORYTELLING_RULE, SYSTEM_PROMPTS


def test_every_age_segment_has_a_prompt():
    assert set(SYSTEM_PROMPTS) == set(AgeSegment)


def test_every_prompt_carries_companion_and_storytelling_rules():
    for segment, prompt in SYSTEM_PROMPTS.items():
        assert COMPANION_STYLE_RULE in prompt, segment
        assert STORYTELLING_RULE in prompt, segment


def test_companion_rule_keeps_the_real_people_boundary():
    """DUYO must point the child back to parents/friends, never replace them."""
    assert "o'rnini BOSMAYSAN" in COMPANION_STYLE_RULE
    assert "yaqin kishilari bilan bo'lishishga undab tur" in COMPANION_STYLE_RULE


def test_companion_rule_forbids_parasocial_and_romantic_framing():
    for banned in ("faqat menga ayt", "men eng yaqin do'stingman", "romantik"):
        assert banned in COMPANION_STYLE_RULE, banned
