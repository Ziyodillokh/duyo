"""Test-phone OTP bypass — fixed code, no Redis/SMS (config-gated)."""

import pytest

from duyo.core.config import get_settings
from duyo.services import otp


@pytest.fixture(autouse=True)
def _force_test_numbers(monkeypatch):
    # Pin the setting so the test is independent of suite ordering / cache state.
    monkeypatch.setattr(get_settings(), "otp_test_numbers", "+998900000000:0000")


async def test_issue_returns_fixed_code_for_test_number():
    assert await otp.issue("+998900000000") == "0000"


async def test_verify_accepts_fixed_code():
    assert await otp.verify("+998900000000", "0000") is True


async def test_verify_rejects_wrong_code():
    assert await otp.verify("+998900000000", "111111") is False


def test_parser_handles_multiple_and_blanks(monkeypatch):
    monkeypatch.setattr(get_settings(), "otp_test_numbers", "+111:222, +333:444 , bad, :, ")
    assert otp._test_numbers() == {"+111": "222", "+333": "444"}
