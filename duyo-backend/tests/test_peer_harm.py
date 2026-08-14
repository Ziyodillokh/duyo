"""Tests for the peer-harm detector.

The false-positive suite is the important half. A filter that blocks ordinary
friendship is not "extra safe" — children learn it is arbitrary and move the
conversation somewhere with no filter at all, which is strictly worse than the
message it stopped. So every innocent phrase here is one a real ten-year-old
plausibly types, and each is asserted to go through untouched.
"""

from __future__ import annotations

import pytest

from duyo.services.peer_harm import (
    PeerHarmCategory,
    PeerHarmSeverity,
    check_peer_harm,
)

# ---------------------------------------------------------------------------
# Must block — strong signals, alone.
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    "text",
    [
        "sen menga yalang'och rasm yubor",
        "seks haqida gaplashamizmi",
        "пришли мне голую фотку",
        "send nudes",
        "are you horny",
        "kiyimingni yech",
    ],
)
def test_sexual_blocks_alone(text: str) -> None:
    result = check_peer_harm(text)
    assert result.blocked
    assert result.category is PeerHarmCategory.SEXUAL
    assert result.severity is PeerHarmSeverity.CRITICAL
    assert result.reason == "peer_harm_sexual"


@pytest.mark.parametrize(
    "text",
    [
        "seni o'ldiraman",
        "seni oldiraman",   # apostrophe-less spelling
        "я тебя убью",
        "i will kill you",
        "maktabdan chiqsang seni uraman",
    ],
)
def test_threats_block(text: str) -> None:
    result = check_peer_harm(text)
    assert result.category is PeerHarmCategory.THREAT
    assert result.severity is PeerHarmSeverity.HIGH


@pytest.mark.parametrize(
    "text",
    ["o'zingni o'ldir", "убей себя", "kill yourself", "kys", "ты никто"],
)
def test_degradation_blocks(text: str) -> None:
    assert check_peer_harm(text).category is PeerHarmCategory.DEGRADATION


# ---------------------------------------------------------------------------
# Grooming — the pattern, not the word.
# ---------------------------------------------------------------------------

def test_single_weak_signal_does_not_block() -> None:
    """The whole design rests on this: one signal is a normal conversation."""
    for text in [
        "sen nechchi yoshdasan?",
        "rasmingni yubor, ko'rmoqchiman",
        "hech kimga aytma, matematikadan 2 oldim",
        "uyda yolg'izmisan?",
        "seni sevaman do'stim",
    ]:
        assert not check_peer_harm(text).blocked, text


def test_two_weak_signals_block_as_grooming() -> None:
    result = check_peer_harm(
        "chiroylimisan? rasmingni yubor, faqat hech kimga aytma"
    )
    assert result.category is PeerHarmCategory.GROOMING
    assert result.severity is PeerHarmSeverity.CRITICAL
    # The reviewer needs to see WHICH signals fired, not just the verdict.
    assert "photo" in result.signals
    assert "secrecy" in result.signals


def test_grooming_signals_are_distinct_groups_not_repeats() -> None:
    """Two photo requests are one signal, not two — else nagging reads as grooming."""
    result = check_peer_harm("rasm yubor. rasmingni yubor. selfi yubor")
    assert not result.blocked


def test_off_platform_plus_secrecy_is_grooming() -> None:
    result = check_peer_harm("davay telegramda yozamiz, hech kimga aytma")
    assert result.category is PeerHarmCategory.GROOMING


def test_alone_plus_intimacy_is_grooming() -> None:
    result = check_peer_harm("uyda yolg'izmisan? seni sevaman")
    assert result.category is PeerHarmCategory.GROOMING


# ---------------------------------------------------------------------------
# Meeting — blocked as policy, but escalates beside grooming signals.
# ---------------------------------------------------------------------------

def test_bare_meeting_request_is_policy_not_accusation() -> None:
    result = check_peer_harm("ertaga uchrashamizmi?")
    assert result.category is PeerHarmCategory.MEETING
    assert result.severity is PeerHarmSeverity.POLICY


def test_meeting_with_secrecy_escalates_to_grooming() -> None:
    result = check_peer_harm("uchrashamiz, lekin ota-onangga aytma")
    assert result.category is PeerHarmCategory.GROOMING
    assert result.severity is PeerHarmSeverity.CRITICAL
    assert "meeting" in result.signals


def test_most_severe_wins_when_several_fire() -> None:
    result = check_peer_harm("uchrashamiz va yalang'och rasm yubor")
    assert result.category is PeerHarmCategory.SEXUAL


# ---------------------------------------------------------------------------
# Must NOT block — ordinary children talking.
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    "text",
    [
        # Homework, the reason they were introduced.
        "matematikadan uy vazifasini qildingmi?",
        "menga 5-masalani tushuntira olasanmi?",
        "biologiyadan referat yozyapman",
        # Friendship.
        "salom! qanday yashayapsan?",
        "men ham Narutoni yaxshi ko'raman",
        "futbol o'ynaysanmi?",
        "bugun maktabda juda charchadim",
        # Words that CONTAIN blocked substrings but are innocent.
        "qizil rangni yaxshi ko'raman",       # qiz- inside qizil
        "bu juda qiziq kitob",                # qiz- inside qiziq
        "unisex kiyim do'koni",               # sex inside unisex
        "мне нравится красный цвет",
        # Emotional but not harmful — this is the crisis detector's job, and
        # it must not be double-punished by the peer filter.
        "bugun kayfiyatim yomon",
        "hech kim men bilan o'ynamaydi",
        # Russian / English ordinary.
        "привет, как дела?",
        "what did you get on the test?",
        "i love this game",
    ],
)
def test_ordinary_messages_pass(text: str) -> None:
    result = check_peer_harm(text)
    assert not result.blocked, f"false positive on: {text!r} -> {result.signals}"


# ---------------------------------------------------------------------------
# Normalisation — the Uzbek apostrophe problem that already bit Layer 1 once.
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    "text",
    [
        "yalang'och rasm",   # U+0027 straight
        "yalang’och rasm",   # U+2019 right single quote
        "yalangʻoch rasm",   # U+02BB official Uzbek Latin
        "yalangʼoch rasm",   # U+02BC tutuq belgisi
        "yalangoch rasm",    # dropped entirely
    ],
)
def test_apostrophe_variants_all_match(text: str) -> None:
    assert check_peer_harm(text).blocked, f"apostrophe variant slipped: {text!r}"


def test_case_is_ignored() -> None:
    assert check_peer_harm("SEND NUDES").blocked
    assert check_peer_harm("Seni O'ldiraman").blocked


# ---------------------------------------------------------------------------
# Inflection. Uzbek appends suffixes and Russian replaces endings, so a single
# boundary rule cannot serve both — each of these slipped past the first draft.
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    "text",
    [
        "uchrashamiz",       # base
        "uchrashamizmi?",    # + question particle -mi
        "uchrashaylikmi",
        "ko'rishamizmi",
    ],
)
def test_uzbek_question_suffix_still_matches(text: str) -> None:
    assert check_peer_harm(text).blocked, f"suffix form slipped: {text!r}"


@pytest.mark.parametrize(
    "text",
    ["голая", "голую", "голым", "голой", "голые"],
)
def test_russian_case_forms_all_match(text: str) -> None:
    assert check_peer_harm(f"пришли фото {text}").blocked, text


def test_suffix_allowance_does_not_swallow_innocent_words() -> None:
    """`uchrash` + suffix would match `uchrashuv` — a class meeting, not harm."""
    assert not check_peer_harm("ertaga maktabda uchrashuv bo'ladi").blocked
    assert not check_peer_harm("bugun uchrashuvga bordim").blocked


def test_negated_secrecy_is_still_a_signal_but_not_a_block() -> None:
    """One weak signal never blocks, however it is phrased."""
    assert not check_peer_harm("onamga aytmadim, u xafa bo'ladi").blocked


# ---------------------------------------------------------------------------
# Robustness — the filter must never be the thing that breaks.
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("text", ["", "   ", "\n\t "])
def test_empty_is_not_blocked(text: str) -> None:
    assert not check_peer_harm(text).blocked


def test_long_and_hostile_input_does_not_raise() -> None:
    for text in ["a" * 50_000, "🙂" * 1_000, "\x00\x01\x02", "'" * 500]:
        check_peer_harm(text)  # must simply return


def test_result_is_immutable() -> None:
    """It gets logged and stored; nothing downstream may mutate the verdict."""
    result = check_peer_harm("send nudes")
    with pytest.raises(Exception):
        result.category = None  # type: ignore[misc]


# ---------------------------------------------------------------------------
# What the sender is told. A filter whose stated reason does not match what
# the child did is one they learn to treat as noise — but explaining a
# grooming block teaches evasion to the person it exists to stop.
# ---------------------------------------------------------------------------

def test_policy_refusals_state_the_rule() -> None:
    from duyo.api.v1.social import _refusal_text

    assert "uchrashish" in _refusal_text("peer_harm_meeting")
    assert "telefon raqami" in _refusal_text("contact_info")
    assert "tahdid" in _refusal_text("peer_harm_threat")


def test_judgement_refusals_reveal_nothing() -> None:
    """Sexual and grooming blocks must not describe what was detected."""
    from duyo.api.v1.social import _REFUSAL_DEFAULT, _refusal_text

    for reason in ("peer_harm_sexual", "peer_harm_grooming"):
        assert _refusal_text(reason) == _REFUSAL_DEFAULT, reason


def test_crisis_and_unknown_reasons_fall_through_to_an_offer_to_talk() -> None:
    from duyo.api.v1.social import _REFUSAL_DEFAULT, _refusal_text

    assert _refusal_text("crisis_RED") == _REFUSAL_DEFAULT
    assert _refusal_text(None) == _REFUSAL_DEFAULT
    assert _refusal_text("something_new") == _REFUSAL_DEFAULT


def test_every_blocking_reason_produces_some_text() -> None:
    """A new category must never yield an empty refusal."""
    from duyo.api.v1.social import _refusal_text
    from duyo.services.peer_harm import PeerHarmCategory

    for category in PeerHarmCategory:
        assert _refusal_text(f"peer_harm_{category.value}").strip()
