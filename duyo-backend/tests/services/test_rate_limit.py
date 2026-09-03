"""The throttle on the two doors that answer to anyone.

Also pins the two decisions that are easy to get backwards: which header the
source is read from, and what happens when Redis is gone.
"""

from __future__ import annotations

import pytest

from duyo.services import rate_limit


class _FakeRedis:
    def __init__(self) -> None:
        self.counts: dict[str, int] = {}
        self.expires: dict[str, int] = {}

    async def incr(self, key):
        self.counts[key] = self.counts.get(key, 0) + 1
        return self.counts[key]

    async def expire(self, key, seconds):
        self.expires[key] = seconds


class _DeadRedis:
    async def incr(self, _key):
        raise ConnectionError("redis is down")

    async def expire(self, _key, _seconds):  # pragma: no cover — never reached
        raise ConnectionError("redis is down")


class _FakeRequest:
    def __init__(self, headers=None, host=None):
        self.headers = headers or {}
        self.client = type("C", (), {"host": host})() if host else None


@pytest.fixture
def redis(monkeypatch):
    fake = _FakeRedis()
    monkeypatch.setattr(rate_limit, "get_redis", lambda: fake)
    return fake


async def test_attempts_within_the_limit_pass(redis):
    for _ in range(5):
        await rate_limit.hit("login", "someone", limit=5, window_seconds=900)


async def test_one_attempt_past_the_limit_is_refused(redis):
    for _ in range(5):
        await rate_limit.hit("login", "someone", limit=5, window_seconds=900)
    with pytest.raises(rate_limit.RateLimited):
        await rate_limit.hit("login", "someone", limit=5, window_seconds=900)


async def test_the_window_is_set_once_not_on_every_hit(redis):
    """A TTL refreshed per attempt is a limit that never resets."""
    await rate_limit.hit("login", "someone", limit=5, window_seconds=900)
    await rate_limit.hit("login", "someone", limit=5, window_seconds=900)
    assert redis.expires == {"ratelimit:login:someone": 900}


async def test_two_callers_do_not_share_an_allowance(redis):
    for _ in range(5):
        await rate_limit.hit("login", "one", limit=5, window_seconds=900)
    await rate_limit.hit("login", "two", limit=5, window_seconds=900)


async def test_a_dead_redis_lets_the_request_through(monkeypatch):
    """Open, not closed: a Redis blip must not lock every family out of login."""
    monkeypatch.setattr(rate_limit, "get_redis", lambda: _DeadRedis())
    await rate_limit.hit("login", "someone", limit=1, window_seconds=900)
    await rate_limit.hit("login", "someone", limit=1, window_seconds=900)


def test_the_source_comes_from_x_real_ip():
    """nginx sets it to $remote_addr. X-Forwarded-For appends to whatever the
    client sent, so its first entry is attacker-chosen."""
    request = _FakeRequest(
        headers={"x-real-ip": "203.0.113.7", "x-forwarded-for": "1.2.3.4, 203.0.113.7"},
        host="10.0.0.1",
    )
    assert rate_limit.client_ip(request) == "203.0.113.7"


def test_without_a_proxy_header_the_socket_address_is_used():
    assert rate_limit.client_ip(_FakeRequest(host="10.0.0.1")) == "10.0.0.1"


def test_an_unidentifiable_caller_shares_one_bucket():
    assert rate_limit.client_ip(None) == "unknown"
