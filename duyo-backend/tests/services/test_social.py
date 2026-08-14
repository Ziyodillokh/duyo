"""Peer-message screening and pair canonicalisation.

These are the structural safety properties of the goal-mates feature, so they
are asserted directly rather than through the endpoints.
"""

from uuid import UUID

from duyo.crisis.detector import KeywordCrisisDetector
from duyo.services.social import (
    canonical_pair,
    generate_handle,
    screen_peer_message,
)


def _detector() -> KeywordCrisisDetector:
    return KeywordCrisisDetector()


def test_ordinary_message_passes():
    assert screen_peer_message("Salom! Sen ham shu kitobni o'qiyapsanmi?", _detector()).allowed


def test_phone_number_is_blocked():
    """Moving a conversation off-platform removes every safety layer at once."""
    for text in (
        "Mening raqamim +998901234567",
        "901234567 ga yoz",
        "raqamim bor senda?",
    ):
        verdict = screen_peer_message(text, _detector())
        assert not verdict.allowed, text
        assert verdict.reason == "contact_info"


def test_social_handles_and_links_are_blocked():
    for text in (
        "telegramda yozamiz @falonchi_bola",
        "instagramga o'tamizmi",
        "mana havola https://example.com/chat",
        "t.me/duyo",
    ):
        assert not screen_peer_message(text, _detector()).allowed, text


def test_crisis_content_never_reaches_a_peer():
    """The author may be the one in trouble; a child must not be their counsellor."""
    verdict = screen_peer_message("men o'zimni o'ldirmoqchiman", _detector())
    assert not verdict.allowed
    assert verdict.reason.startswith("crisis_")


def test_empty_and_oversized_are_rejected():
    assert not screen_peer_message("   ", _detector()).allowed
    assert not screen_peer_message("a" * 501, _detector()).allowed


# ── peer harm ─────────────────────────────────────────────────────────────────
# The crisis detector asks whether the AUTHOR is in danger. These ask whether
# the author IS the danger — a question it has no category for, which is why
# `services.peer_harm` exists and why this wiring is asserted here.

def test_sexual_solicitation_is_blocked():
    verdict = screen_peer_message("yalang'och rasmingni yubor", _detector())
    assert not verdict.allowed
    assert verdict.reason == "peer_harm_sexual"


def test_grooming_pattern_is_blocked():
    verdict = screen_peer_message(
        "chiroylimisan? rasmingni yubor, hech kimga aytma", _detector()
    )
    assert not verdict.allowed
    assert verdict.reason == "peer_harm_grooming"


def test_offline_meeting_is_blocked_by_policy():
    verdict = screen_peer_message("ertaga uchrashamizmi?", _detector())
    assert not verdict.allowed
    assert verdict.reason == "peer_harm_meeting"


def test_peer_harm_reason_wins_over_crisis_for_a_threat():
    """A threat is also a violence keyword. The reason a reviewer sees must
    describe what happened — one child threatening another — not the crisis
    flow's reading of it, which would route help to the wrong child."""
    verdict = screen_peer_message("seni o'ldiraman", _detector())
    assert not verdict.allowed
    assert verdict.reason == "peer_harm_threat"


def test_ordinary_friendship_still_passes_both_filters():
    for text in (
        "Salom! Matematikadan uy vazifasini qildingmi?",
        "Men ham Narutoni yaxshi ko'raman",
        "Bugun maktabda charchadim",
    ):
        assert screen_peer_message(text, _detector()).allowed, text


def test_canonical_pair_is_order_independent():
    """Storing (low, high) makes a duplicate-direction row impossible."""
    a = UUID("00000000-0000-0000-0000-00000000000a")
    b = UUID("00000000-0000-0000-0000-00000000000b")
    assert canonical_pair(a, b) == canonical_pair(b, a) == (a, b)


def test_handles_carry_no_personal_information():
    for _ in range(20):
        handle = generate_handle()
        word, _, number = handle.partition("-")
        assert word.isalpha() and number.isdigit()
        assert len(handle) <= 24
