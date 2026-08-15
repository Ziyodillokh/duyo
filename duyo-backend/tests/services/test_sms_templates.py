"""Every SMS body must match an Eskiz-approved template, exactly.

Eskiz delivers ONLY text matching a template its moderators approved and
rejects everything else at send time. A rejected send is silent — the caller
gets no SMS and nobody is told — so for a crisis alert this is a child-safety
failure with no symptom. That is not hypothetical: the ORANGE crisis body had
drifted an extra "Maslahat: 1142" past its approved text and every ORANGE
parent alert was being rejected in production.

These patterns are the approved templates on account farzandimtech@gmail.com,
read from GET https://notify.eskiz.uz/api/user/templates on 2026-08-15:

    83331  DUYO ilovasiga kirish uchun tasdiqlash kodi: %d (5 daqiqa amal qiladi.)
    83332  DUYO XAVF: %w{1,4} bola jiddiy xavf signal berdi. Iltimos DARHOL
           bog'laning. Ishonch telefon: 1142
    83333  DUYO: %w{1,4} bola xabarida tashvishli signallar bor. 24 soat ichida
           bola bilan suhbat o'tkazing.

If a template is legitimately re-worded, it must be re-submitted to Eskiz and
approved BEFORE the constant here changes — otherwise this test is the only
thing standing between a reworded string and silently undelivered SMS.
"""

from __future__ import annotations

import re

import pytest

from duyo.services.sms import (
    CRISIS_ORANGE_TEMPLATE,
    CRISIS_RED_TEMPLATE,
    OTP_TEMPLATE,
    crisis_message,
    otp_message,
)

# Verbatim from the Eskiz API. Do not edit without re-approval upstream.
APPROVED_OTP = "DUYO ilovasiga kirish uchun tasdiqlash kodi: %d (5 daqiqa amal qiladi.)"
APPROVED_RED = (
    "DUYO XAVF: %w{1,4} bola jiddiy xavf signal berdi. "
    "Iltimos DARHOL bog'laning. Ishonch telefon: 1142"
)
APPROVED_ORANGE = (
    "DUYO: %w{1,4} bola xabarida tashvishli signallar bor. "
    "24 soat ichida bola bilan suhbat o'tkazing."
)


def _to_regex(template: str) -> re.Pattern[str]:
    """Eskiz template → the pattern it accepts.

    `%d` is a run of digits; `%w{1,4}` is one to four whitespace-separated
    words. Everything else must match literally, which is the whole point.
    """
    out = ""
    i = 0
    while i < len(template):
        if template.startswith("%d", i):
            out += r"\d+"
            i += 2
        elif template.startswith("%w{1,4}", i):
            out += r"\S+(?:\s+\S+){0,3}"
            i += 7
        else:
            out += re.escape(template[i])
            i += 1
    return re.compile(f"^{out}$")


# ── the bodies the app actually sends ───────────────────────────────────────

def test_otp_body_matches_the_approved_template():
    assert _to_regex(APPROVED_OTP).match(otp_message("12345"))


@pytest.mark.parametrize("code", ["00000", "12345", "99999"])
def test_otp_body_matches_for_any_code(code):
    assert _to_regex(APPROVED_OTP).match(otp_message(code))


def test_red_crisis_body_matches_the_approved_template():
    assert _to_regex(APPROVED_RED).match(crisis_message("Aziza", red=True))


def test_orange_crisis_body_matches_the_approved_template():
    """The regression: this body carried a trailing 'Maslahat: 1142'."""
    assert _to_regex(APPROVED_ORANGE).match(crisis_message("Aziza", red=False))


@pytest.mark.parametrize("name", ["Aziza", "Aziza Karimova", "Bek", "A"])
def test_crisis_bodies_match_for_ordinary_names(name):
    assert _to_regex(APPROVED_RED).match(crisis_message(name, red=True))
    assert _to_regex(APPROVED_ORANGE).match(crisis_message(name, red=False))


# ── the wildcard's edges ────────────────────────────────────────────────────

def test_a_long_name_is_clamped_to_fit_the_four_word_wildcard():
    """%w{1,4} caps at four words; ChildProfile.name allows up to 80 chars.

    Without clamping, a child with a five-word name would push every crisis
    alert about them off-template — the alerts that matter most, lost for the
    children whose names happen to be long.
    """
    long_name = "Aziza Karimova Nodirbekovna Toshkentlik Qizi"  # 5 words
    assert len(long_name.split()) > 4
    for red in (True, False):
        body = crisis_message(long_name, red=red)
        pattern = APPROVED_RED if red else APPROVED_ORANGE
        assert _to_regex(pattern).match(body), body


def test_a_blank_name_still_produces_an_on_template_body():
    """An empty slot would collapse the spacing and miss the pattern."""
    for red in (True, False):
        body = crisis_message("   ", red=red)
        pattern = APPROVED_RED if red else APPROVED_ORANGE
        assert _to_regex(pattern).match(body), body


# ── the constants themselves ────────────────────────────────────────────────

def test_module_constants_are_the_approved_text():
    """Catches a reworded constant even if no caller is exercised."""
    assert _to_regex(APPROVED_OTP).match(OTP_TEMPLATE.format(code="12345"))
    assert _to_regex(APPROVED_RED).match(CRISIS_RED_TEMPLATE.format(name="Aziza"))
    assert _to_regex(APPROVED_ORANGE).match(CRISIS_ORANGE_TEMPLATE.format(name="Aziza"))


def test_the_pattern_builder_actually_rejects_off_template_text():
    """A matcher that accepts everything would make this whole file useless."""
    assert not _to_regex(APPROVED_ORANGE).match(
        crisis_message("Aziza", red=False) + " Maslahat: 1142"
    )
    assert not _to_regex(APPROVED_OTP).match("Butunlay boshqa matn")
