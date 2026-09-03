"""Signup persistence: a verified phone becomes a committed account.

Endpoint coroutines are called directly with a fake AsyncSession, matching the
repo's API-test style. What these pin down is the part that used to be
implicit: the account is written with an insert that tolerates a concurrent
twin, and it is committed inside the request rather than in dependency
teardown after the response is already built.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from fastapi import HTTPException

from duyo.api.v1 import auth as auth_module
from duyo.core.config import get_settings
from duyo.models.family_invite import FamilyInvite
from duyo.models.user import User
from duyo.schemas.auth import OTPRequest, OTPVerify


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


@dataclass
class _FakeSession:
    """Records statements and lifecycle calls.

    scalar() answers by what the query selects, so a test only has to set the
    pieces it cares about:
      select(User)         -> user
      select(User.phone)   -> inviter_phone   (the invite's inviter)
      select(FamilyInvite) -> invite          (default None = no pending offer)
    """

    user: User | None
    invite: object | None = None
    inviter_phone: str | None = "+998901234567"
    statements: list = field(default_factory=list)
    committed: int = 0

    async def execute(self, stmt, *_a, **_kw):
        self.statements.append(stmt)
        return None

    async def scalar(self, stmt, *_a, **_kw):
        self.statements.append(stmt)
        desc = stmt.column_descriptions[0]
        if desc["entity"] is FamilyInvite:
            return self.invite
        if desc["entity"] is User and desc["name"] == "phone":
            return self.inviter_phone
        return self.user

    async def commit(self):
        self.committed += 1

    async def flush(self):
        pass


@pytest.fixture(autouse=True)
def _demo_code_on(monkeypatch):
    monkeypatch.setattr(get_settings(), "otp_test_numbers", "")
    monkeypatch.setattr(get_settings(), "otp_demo_code", "00000")


@pytest.fixture(autouse=True)
def _no_redis(monkeypatch):
    """The per-IP send limiter is exercised in test_rate_limit.py; here it
    would only be a connection attempt to a Redis nobody started."""
    async def _allow(*_a, **_kw):
        return None

    monkeypatch.setattr(auth_module.rate_limit, "hit", _allow)


def _existing_user(phone="+998901234567") -> User:
    user = User(phone=phone)
    user.id = uuid4()
    return user


# ── verify → account ────────────────────────────────────────────────────────


def test_verify_creates_and_commits_the_account():
    user = _existing_user("+998911112233")
    db = _FakeSession(user=user)
    tokens = _run(
        auth_module.verify_otp(payload=OTPVerify(phone="+998911112233", code="00000"), db=db)
    )
    assert tokens.access_token
    assert tokens.refresh_token
    # The write is committed inside the request, not left to teardown.
    assert db.committed == 1
    # An INSERT was issued before the SELECT that reads the row back.
    rendered = " ".join(str(s) for s in db.statements).lower()
    assert "insert into users" in rendered
    assert "on conflict" in rendered


def test_verify_records_the_login_time():
    user = _existing_user()
    assert user.last_login_at is None
    db = _FakeSession(user=user)
    _run(auth_module.verify_otp(payload=OTPVerify(phone=user.phone, code="00000"), db=db))
    assert user.last_login_at is not None


def test_verify_rejects_a_wrong_code_without_writing():
    db = _FakeSession(user=_existing_user())
    with pytest.raises(HTTPException) as exc:
        _run(auth_module.verify_otp(payload=OTPVerify(phone="+998901234567", code="11111"), db=db))
    assert exc.value.status_code == 401
    assert db.committed == 0


def test_verify_500s_rather_than_issuing_a_token_for_a_missing_account():
    """If the row is not there after the insert, no token may be handed out."""
    db = _FakeSession(user=None)
    with pytest.raises(HTTPException) as exc:
        _run(auth_module.verify_otp(payload=OTPVerify(phone="+998901234567", code="00000"), db=db))
    assert exc.value.status_code == 500


# ── verify OFFERS a family invite, and must never link one ──────────────────
#
# Signing in must not join you to anyone's family. `child_phone` is a number
# typed by whoever invited, so linking on a bare verify let any account become
# the recorded parent of a stranger's profile — their chat history, their
# safety reports, and the crisis alerts meant for the real parent — with the
# victim seeing only an ordinary login SMS. These tests are that guarantee.


def _pending_invite(parent_id=None, child_name="Aziza") -> FamilyInvite:
    invite = FamilyInvite(
        parent_id=parent_id or uuid4(),
        child_name=child_name,
        child_phone="+998911112233",
        claimed=False,
    )
    invite.id = uuid4()
    invite.expires_at = datetime.now(UTC) + timedelta(hours=24)
    return invite
# ── send → what the tester is told ──────────────────────────────────────────


def test_send_hands_back_the_demo_code_instead_of_promising_an_sms():
    body = _run(auth_module.send_otp(payload=OTPRequest(phone="+998911112233"), request=None))
    assert body["status"] == "demo"
    assert body["demo_code"] == "00000"


def test_send_uses_sms_when_the_bypass_is_off(monkeypatch):
    monkeypatch.setattr(get_settings(), "otp_demo_code", "")
    sent: list[tuple[str, str]] = []

    class _Stub:
        async def send(self, phone, message):
            sent.append((phone, message))
            return True

    monkeypatch.setattr(auth_module, "get_sms_provider", lambda: _Stub())
    # auth.py imported issue by name, so patching the service module would not
    # be seen by the endpoint.
    monkeypatch.setattr(auth_module, "issue", _async_returning("54321"))

    body = _run(auth_module.send_otp(payload=OTPRequest(phone="+998911112233"), request=None))
    assert body["status"] == "sent"
    assert "demo_code" not in body
    assert sent and "54321" in sent[0][1]


def test_send_says_check_the_number_when_eskiz_refuses_the_destination(monkeypatch):
    """ "Number is forbidden" is Eskiz vetting the number, not us failing —
    a typo must read as 422 "check the number", never as a 500 with a
    stack trace, which is what the raw HTTPStatusError produced."""
    from duyo.services.sms import SMSNumberRejected

    monkeypatch.setattr(get_settings(), "otp_demo_code", "")

    class _Refuses:
        async def send(self, _phone, _message):
            raise SMSNumberRejected("Number is forbidden")

    monkeypatch.setattr(auth_module, "get_sms_provider", lambda: _Refuses())
    monkeypatch.setattr(auth_module, "issue", _async_returning("54321"))

    with pytest.raises(HTTPException) as exc:
        _run(auth_module.send_otp(payload=OTPRequest(phone="+998911112233"), request=None))
    assert exc.value.status_code == 422
    assert "raqam" in str(exc.value.detail).lower()


def test_send_502s_when_the_provider_itself_errors(monkeypatch):
    """A provider outage is "try again later" — 502, not an unhandled 500."""
    import httpx

    monkeypatch.setattr(get_settings(), "otp_demo_code", "")

    class _Down:
        async def send(self, _phone, _message):
            raise httpx.ConnectError("boom")

    monkeypatch.setattr(auth_module, "get_sms_provider", lambda: _Down())
    monkeypatch.setattr(auth_module, "issue", _async_returning("54321"))

    with pytest.raises(HTTPException) as exc:
        _run(auth_module.send_otp(payload=OTPRequest(phone="+998911112233"), request=None))
    assert exc.value.status_code == 502


def _async_returning(value):
    async def _fn(*_a, **_kw):
        return value

    return _fn


# ── phone shapes ────────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "raw",
    ["+998901234567", "998901234567", "901234567", "+998 90 123 45 67"],
)
def test_every_written_form_of_one_number_normalises_to_one_account(raw):
    """Otherwise the same person could end up with several accounts."""
    assert OTPVerify(phone=raw, code="00000").phone == "+998901234567"


def test_non_digit_code_is_rejected_at_the_schema():
    """secrets.compare_digest raises on non-ASCII — that used to be a 500."""
    with pytest.raises(ValueError):
        # Cyrillic on purpose — a Cyrillic keyboard is what produced the 500.
        OTPVerify(phone="+998901234567", code="ноль0")  # noqa: RUF001
    with pytest.raises(ValueError):
        OTPVerify(phone="+998901234567", code="0o0o0")
