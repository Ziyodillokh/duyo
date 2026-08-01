"""System-prompt guards.

The companion persona (COMPANION_STYLE_RULE) deliberately borrows the warm,
remembering, emotionally-attuned traits of adult companion apps WITHOUT their
parasocial core. These tests pin the safety boundary so a future prompt edit
can't quietly drop it.
"""

from duyo.models.child import AgeSegment
from duyo.prompts import (
    COMPANION_STYLE_RULE,
    LANGUAGE_MIRROR_RULE,
    STORYTELLING_RULE,
    SYSTEM_PROMPTS,
)


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


def test_prompts_do_not_hardcode_a_reply_language():
    """Regression: the age prompts used to say "O'zbek tilida javob ber",
    so a Russian or English question came back in Uzbek."""
    for segment, prompt in SYSTEM_PROMPTS.items():
        assert "O'zbek tilida javob ber" not in prompt, segment


def test_every_prompt_carries_the_language_mirror_rule():
    for segment, prompt in SYSTEM_PROMPTS.items():
        assert LANGUAGE_MIRROR_RULE in prompt, segment


def test_language_rule_names_all_three_supported_languages():
    for token in ("o'zbekcha", "ruscha", "inglizcha"):
        assert token in LANGUAGE_MIRROR_RULE.lower(), token


def test_language_rule_outranks_the_uzbek_wording_around_it():
    """The instructions are written in Uzbek; the rule must say so explicitly,
    otherwise the model reads the prompt language as the answer language."""
    assert "javob tili faqat bolaning tiliga bog'liq" in LANGUAGE_MIRROR_RULE
