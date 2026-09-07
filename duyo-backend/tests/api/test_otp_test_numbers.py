"""The reviewer's login must not depend on a SIM existing.

Play requires working credentials for an app behind a phone login, and
OTP_TEST_NUMBERS is how DUYO supplies them: a fixed number with a fixed code.
`otp.issue()` has always skipped Redis and SMS for those — but the route then
sent the SMS anyway, so a number with no SIM behind it came back from Eskiz as
SMSNumberRejected and the caller got a 422. The one account Google is given
dead-ended on the first screen.
"""

from __future__ import annotations

import asyncio

import pytest
from fastapi import HTTPException

from duyo.api.v1 import auth as auth_module
from duyo.schemas.auth import OTPRequest
from duyo.services import otp, rate_limit


def _run(coro):
    """The sync helper every other file in tests/api uses.

    Not `async def` tests: pytest-asyncio's auto mode closes its loop when one
    finishes, and the neighbouring files call `asyncio.get_event_loop()`, which
    then finds none. An async test placed midway through this directory takes
    out everything after it.
    """
    return asyncio.get_event_loop().run_until_complete(coro)


TEST_PHONE = "+998901112233"
TEST_CODE = "123456"


class _Request:
    client = None

    def __init__(self) -> None:
        self.headers = {"x-real-ip": "203.0.113.9"}


@pytest.fixture(autouse=True)
def _no_ip_limit(monkeypatch):
    async def _hit(*_a, **_kw):
        return 1

    monkeypatch.setattr(rate_limit, "hit", _hit)
    monkeypatch.setattr(auth_module.rate_limit, "hit", _hit)


@pytest.fixture
def _configured(monkeypatch):
    """OTP_TEST_NUMBERS set, the way it will be in production for review."""
    monkeypatch.setattr(otp, "_test_numbers", lambda: {TEST_PHONE: TEST_CODE})
    monkeypatch.setattr(auth_module, "demo_code", lambda: "")


class _ExplodingSMS:
    """Eskiz, asked to text a number that does not exist."""

    def __init__(self):
        self.calls = 0

    async def send(self, *_a, **_kw):
        self.calls += 1
        raise auth_module.SMSNumberRejected("no such subscriber")


def test_a_test_number_never_reaches_the_sms_provider(monkeypatch, _configured):
    sms = _ExplodingSMS()
    monkeypatch.setattr(auth_module, "get_sms_provider", lambda: sms)

    result = _run(auth_module.send_otp(OTPRequest(phone=TEST_PHONE), _Request()))

    assert result["status"] == "test"
    assert sms.calls == 0, "the reviewer's number must not be texted"


def test_an_ordinary_number_still_goes_to_sms(monkeypatch, _configured):
    """The bypass is narrow: everyone else is unaffected."""
    sms = _ExplodingSMS()
    monkeypatch.setattr(auth_module, "get_sms_provider", lambda: sms)

    with pytest.raises(HTTPException) as caught:
        _run(auth_module.send_otp(OTPRequest(phone="+998907654321"), _Request()))

    assert caught.value.status_code == 422
    assert sms.calls == 1


def test_the_fixed_code_is_not_handed_back(monkeypatch, _configured):
    """Unlike the demo bypass, which publishes its code on purpose.

    A test number's code is a credential for one account, so the response says
    only that no SMS is coming.
    """
    monkeypatch.setattr(auth_module, "get_sms_provider", lambda: _ExplodingSMS())

    result = _run(auth_module.send_otp(OTPRequest(phone=TEST_PHONE), _Request()))

    assert TEST_CODE not in str(result)


def test_verify_accepts_the_fixed_code(_configured):
    assert _run(otp.verify(TEST_PHONE, TEST_CODE)) is True
    assert _run(otp.verify(TEST_PHONE, "000000")) is False


def test_is_test_number_is_exact(_configured):
    assert otp.is_test_number(TEST_PHONE) is True
    assert otp.is_test_number("+998900000000") is False
