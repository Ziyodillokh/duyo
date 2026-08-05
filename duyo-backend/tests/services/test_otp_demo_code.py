"""The pilot bypass: one published code, accepted for every phone number.

This is what lets testers sign up with their own real number while no SMS
provider is connected. The tests pin the two properties that matter: it works
for a number nobody allow-listed, and it still rejects a wrong code.
"""

import pytest

from duyo.core.config import get_settings
from duyo.services import otp

ARBITRARY = "+998911112233"  # deliberately NOT in otp_test_numbers


@pytest.fixture(autouse=True)
def _demo_code_on(monkeypatch):
    monkeypatch.setattr(get_settings(), "otp_test_numbers", "")
    monkeypatch.setattr(get_settings(), "otp_demo_code", "00000")


@pytest.fixture
def _redis_explodes(monkeypatch):
    """Any Redis use is a bug in the demo path — signup must survive an outage."""

    def _boom():
        raise AssertionError("demo path must not touch Redis")

    monkeypatch.setattr(otp, "get_redis", _boom)


async def test_verify_accepts_demo_code_for_any_number(_redis_explodes):
    assert await otp.verify(ARBITRARY, "00000") is True


async def test_verify_accepts_demo_code_for_a_second_unrelated_number(_redis_explodes):
    assert await otp.verify("+998939998877", "00000") is True


async def test_verify_rejects_a_different_code(_redis_explodes):
    """One code is accepted, not any code."""
    assert await otp.verify(ARBITRARY, "12345") is False


async def test_issue_returns_the_demo_code(_redis_explodes):
    assert await otp.issue(ARBITRARY) == "00000"


async def test_allowlisted_number_still_wins_over_demo_code(monkeypatch, _redis_explodes):
    """A test phone keeps its own code even while the demo bypass is on."""
    monkeypatch.setattr(get_settings(), "otp_test_numbers", "+998900000000:54321")
    assert await otp.verify("+998900000000", "54321") is True
    assert await otp.verify("+998900000000", "00000") is False


async def test_demo_off_falls_back_to_the_normal_path(monkeypatch):
    """With the bypass cleared, an un-issued code is rejected as before."""
    monkeypatch.setattr(get_settings(), "otp_demo_code", "")

    class _NoCode:
        async def incr(self, *_a):
            return 1

        async def expire(self, *_a):
            return True

        async def get(self, *_a):
            return None

    monkeypatch.setattr(otp, "get_redis", lambda: _NoCode())
    with pytest.raises(otp.OTPInvalid):
        await otp.verify(ARBITRARY, "00000")


def test_demo_code_helper_reflects_settings(monkeypatch):
    assert otp.demo_code() == "00000"
    monkeypatch.setattr(get_settings(), "otp_demo_code", "")
    assert otp.demo_code() == ""
