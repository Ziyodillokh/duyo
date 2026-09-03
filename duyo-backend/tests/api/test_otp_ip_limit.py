"""OTP sends are bounded per source, not only per phone number.

The per-phone counter bounds how often ONE number is messaged. Nothing bounded
how many DIFFERENT numbers one caller could walk, which makes
+998 9X XXX XX XX an SMS-bombing list billed to our Eskiz balance — and a
suspended sender ID stops crisis alerts to parents, not just logins.
"""

from __future__ import annotations

import asyncio

import pytest
from fastapi import HTTPException

from duyo.api.v1 import auth as auth_module
from duyo.core.config import get_settings
from duyo.schemas.auth import OTPRequest
from duyo.services import rate_limit


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


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


@pytest.fixture(autouse=True)
def _demo_code_on(monkeypatch):
    """Short-circuits SMS: the send path is tested elsewhere, the limit here."""
    monkeypatch.setattr(get_settings(), "otp_test_numbers", "")
    monkeypatch.setattr(get_settings(), "otp_demo_code", "00000")


@pytest.fixture
def redis(monkeypatch):
    fake = _FakeRedis()
    monkeypatch.setattr(rate_limit, "get_redis", lambda: fake)
    return fake


def _send(phone: str):
    return _run(auth_module.send_otp(payload=OTPRequest(phone=phone), request=_FakeRequest()))


def test_walking_a_list_of_numbers_from_one_source_is_cut_off(redis):
    limit = get_settings().otp_rate_limit_per_ip_per_hour
    for n in range(limit):
        _send(f"+9989011122{n:02d}")
    with pytest.raises(HTTPException) as exc:
        _send("+998901112299")
    assert exc.value.status_code == 429


def test_the_counter_is_keyed_on_the_source_not_the_number(redis):
    _send("+998901112201")
    _send("+998901112202")
    assert set(redis.counts) == {"ratelimit:otp_send_ip:203.0.113.7"}
