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
from uuid import uuid4

import pytest
from fastapi import HTTPException

from duyo.api.v1 import auth as auth_module
from duyo.core.config import get_settings
from duyo.models.user import User
from duyo.schemas.auth import OTPRequest, OTPVerify


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


@dataclass
class _FakeSession:
    """Records statements and lifecycle calls; returns `user` from scalar()."""

    user: User | None
    statements: list = field(default_factory=list)
    committed: int = 0

    async def execute(self, stmt, *_a, **_kw):
        self.statements.append(stmt)
        return None

    async def scalar(self, stmt, *_a, **_kw):
        self.statements.append(stmt)
        return self.user

    async def commit(self):
        self.committed += 1

    async def flush(self):
        pass


@pytest.fixture(autouse=True)
def _demo_code_on(monkeypatch):
    monkeypatch.setattr(get_settings(), "otp_test_numbers", "")
    monkeypatch.setattr(get_settings(), "otp_demo_code", "00000")


def _existing_user(phone="+998901234567") -> User:
    user = User(phone=phone)
    user.id = uuid4()
    return user


# ── verify → account ────────────────────────────────────────────────────────

def test_verify_creates_and_commits_the_account():
    user = _existing_user("+998911112233")
    db = _FakeSession(user=user)
    tokens = _run(
        auth_module.verify_otp(
            payload=OTPVerify(phone="+998911112233", code="00000"), db=db
        )
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
        _run(
            auth_module.verify_otp(
                payload=OTPVerify(phone="+998901234567", code="11111"), db=db
            )
        )
    assert exc.value.status_code == 401
    assert db.committed == 0


def test_verify_500s_rather_than_issuing_a_token_for_a_missing_account():
    """If the row is not there after the insert, no token may be handed out."""
    db = _FakeSession(user=None)
    with pytest.raises(HTTPException) as exc:
        _run(
            auth_module.verify_otp(
                payload=OTPVerify(phone="+998901234567", code="00000"), db=db
            )
        )
    assert exc.value.status_code == 500


# ── send → what the tester is told ──────────────────────────────────────────

def test_send_hands_back_the_demo_code_instead_of_promising_an_sms():
    body = _run(auth_module.send_otp(payload=OTPRequest(phone="+998911112233")))
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

    body = _run(auth_module.send_otp(payload=OTPRequest(phone="+998911112233")))
    assert body["status"] == "sent"
    assert "demo_code" not in body
    assert sent and "54321" in sent[0][1]


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
