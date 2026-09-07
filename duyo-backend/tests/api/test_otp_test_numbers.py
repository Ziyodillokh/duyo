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
from duyo.billing import tiers as otp_tiers
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
    """The bypass is narrow: everyone else is unaffected.

    `issue` is stubbed because for a real number it reaches Redis, and this
    test is about which branch the ROUTE takes, not about code storage. CI has
    no Redis and caught the difference.
    """
    sms = _ExplodingSMS()
    monkeypatch.setattr(auth_module, "get_sms_provider", lambda: sms)

    async def _issued(_phone):
        return "654321"

    monkeypatch.setattr(auth_module, "issue", _issued)

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


# ── the reviewer sees the whole app ──────────────────────────────────────────
#
# Play states that its reviewers will not buy a subscription or take a free
# trial, and that an app they cannot fully reach may be rejected. Voice — the
# one feature the paid tier is sold on — is gated, so a review account on the
# free tier would be shown a paywall where the feature is supposed to be.


class _Sub:
    def __init__(self):
        self.tier = "free"
        self.status = "active"
        self.provider = None
        self.started_at = None
        self.expires_at = None


class _VerifySession:
    """Enough of AsyncSession for the verify route."""

    def __init__(self, user, sub):
        self._user = user
        self._sub = sub
        self.committed = False

    async def execute(self, *_a, **_kw):
        return None

    async def scalar(self, *_a, **_kw):
        # First call resolves the User, later ones the Subscription.
        return self._user if self._user_pending() else self._sub

    def _user_pending(self):
        pending, self._returned_user = not getattr(self, "_returned_user", False), True
        return pending

    def add(self, _obj):
        pass

    async def flush(self):
        pass

    async def commit(self):
        self.committed = True


def _verify(monkeypatch, phone, session):
    async def _ok(_p, _c):
        return True

    monkeypatch.setattr(auth_module, "verify", _ok)
    monkeypatch.setattr(auth_module, "get_or_create_subscription", lambda *_a, **_k: None, raising=False)
    from duyo.schemas.auth import OTPVerify

    return _run(auth_module.verify_otp(OTPVerify(phone=phone, code=TEST_CODE), session))


def test_a_review_login_is_granted_the_paid_tier(monkeypatch, _configured):
    from duyo.models.user import User

    user = User(phone=TEST_PHONE)
    user.id = __import__("uuid").uuid4()
    user.token_version = 1
    sub = _Sub()
    session = _VerifySession(user, sub)

    _verify(monkeypatch, TEST_PHONE, session)

    assert sub.tier == otp_tiers.PREMIUM, "the reviewer would have hit a paywall on voice"
    assert sub.expires_at is not None
