"""OTP_TEST_NUMBERS is the reviewer's login, and it fails silently.

The app's OTP field accepts exactly `otp_length` digits and drops the rest, so
a six-digit code typed into a five-digit field is SENT as five and compared
against six: 401, with nothing anywhere saying why. The reviewer sees a code
that does not work and the app is rejected without being opened.

This happened. The value shipped in the submission guide was six digits while
`otp_length` was five.
"""

from __future__ import annotations

import pytest

from duyo.core.config import Settings


def _settings(**kw) -> Settings:
    return Settings(app_secret_key="x" * 32, **kw)


def test_a_matching_code_is_fine():
    s = _settings(otp_test_numbers="+998901112233:12345", otp_length=5)
    assert s.otp_test_numbers_misconfigured() is None


def test_nothing_configured_is_fine():
    assert _settings(otp_test_numbers="").otp_test_numbers_misconfigured() is None


def test_the_six_digit_mistake_is_caught():
    s = _settings(otp_test_numbers="+998901112233:123456", otp_length=5)

    problem = s.otp_test_numbers_misconfigured()

    assert problem is not None
    assert "6 digits" in problem
    assert "5" in problem


def test_a_short_code_is_caught_too():
    s = _settings(otp_test_numbers="+998901112233:123", otp_length=5)
    assert "3 digits" in (s.otp_test_numbers_misconfigured() or "")


def test_the_length_is_read_from_settings_not_hardcoded():
    """Raising otp_length must not turn every working code into a problem
    silently — it makes the OLD ones wrong, and says so."""
    s = _settings(otp_test_numbers="+998901112233:12345", otp_length=6)
    assert "5 digits" in (s.otp_test_numbers_misconfigured() or "")


def test_a_non_numeric_code_is_caught():
    s = _settings(otp_test_numbers="+998901112233:abcde", otp_length=5)
    assert "not digits" in (s.otp_test_numbers_misconfigured() or "")


def test_a_malformed_pair_is_caught():
    s = _settings(otp_test_numbers="+998901112233", otp_length=5)
    assert "not phone:code" in (s.otp_test_numbers_misconfigured() or "")


def test_every_bad_entry_is_reported_not_just_the_first():
    """An operator fixing one and redeploying to find the next is a bad loop."""
    s = _settings(
        otp_test_numbers="+998901112233:123456,+998907654321:99",
        otp_length=5,
    )

    problem = s.otp_test_numbers_misconfigured() or ""

    assert "+998901112233" in problem
    assert "+998907654321" in problem


@pytest.mark.parametrize("raw", ["", "   ", ",", " , "])
def test_blank_entries_are_ignored(raw):
    assert _settings(otp_test_numbers=raw).otp_test_numbers_misconfigured() is None
