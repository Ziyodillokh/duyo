"""The admin login is throttled, and throttled BEFORE the password check.

Order is the whole point. verify_password is 240,000 PBKDF2 rounds, so a limit
applied after it still lets an unauthenticated stranger spend both uvicorn
workers on a small VPS — and the route is the way into a SAFETY_OFFICER
account, which reads every crisis event.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass

import pytest
from fastapi import HTTPException

from duyo.api.v1 import admin as admin_module
from duyo.core.admin_security import hash_password
from duyo.core.config import get_settings
from duyo.models.admin import AdminRole, AdminUser
from duyo.services import rate_limit


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


@dataclass
class _FakeSession:
    """Answers with a real, active admin, so a wrong password reaches
    verify_password — which is exactly what the limit has to stop."""

    admin: object | None = None

    async def scalar(self, *_a, **_kw):
        return self.admin

    async def flush(self):
        pass


def _admin_row():
    return AdminUser(
        email="admin@duyo.uz",
        full_name="Admin",
        role=AdminRole.SUPER_ADMIN,
        password_hash=hash_password("correct horse"),
        is_active=True,
    )


class _FakeRequest:
    client = None

    def __init__(self) -> None:
        self.headers = {"x-real-ip": "203.0.113.7"}


class _FakeRedis:
    def __init__(self) -> None:
        self.counts: dict[str, int] = {}

    async def incr(self, key):
        self.counts[key] = self.counts.get(key, 0) + 1
        return self.counts[key]

    async def expire(self, _key, _seconds):
        pass


@pytest.fixture
def redis(monkeypatch):
    fake = _FakeRedis()
    monkeypatch.setattr(rate_limit, "get_redis", lambda: fake)
    return fake


@pytest.fixture
def never_hashes(monkeypatch):
    """verify_password must not be reached once the limit is spent."""
    calls: list[int] = []

    def _counted(_password, _stored):
        calls.append(1)
        return False

    monkeypatch.setattr(admin_module, "verify_password", _counted)
    return calls


def _login(email="admin@duyo.uz"):
    return _run(
        admin_module.admin_login(
            payload=admin_module.AdminLogin(email=email, password="wrong"),
            request=_FakeRequest(),
            db=_FakeSession(_admin_row()),
        )
    )


def test_a_wrong_password_is_a_401_until_the_limit(redis, never_hashes):
    for _ in range(get_settings().admin_login_max_attempts):
        with pytest.raises(HTTPException) as exc:
            _login()
        assert exc.value.status_code == 401


def test_one_attempt_past_the_limit_is_a_429(redis, never_hashes):
    for _ in range(get_settings().admin_login_max_attempts):
        with pytest.raises(HTTPException):
            _login()
    with pytest.raises(HTTPException) as exc:
        _login()
    assert exc.value.status_code == 429


def test_the_throttled_attempts_never_reach_pbkdf2(redis, never_hashes):
    limit = get_settings().admin_login_max_attempts
    for _ in range(limit + 3):
        with pytest.raises(HTTPException):
            _login()
    assert len(never_hashes) == limit


def test_one_attacker_cannot_lock_a_real_admin_out(redis, never_hashes):
    """Keyed on email AND source: spending someone else's allowance from your
    own address must not be a denial of service against them."""
    for _ in range(get_settings().admin_login_max_attempts + 1):
        with pytest.raises(HTTPException):
            _login("victim@duyo.uz")
    assert set(redis.counts) == {"ratelimit:admin_login:victim@duyo.uz|203.0.113.7"}
