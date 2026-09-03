"""Redis fixed-window rate limiting for the unauthenticated doors.

Two endpoints answer to anyone on the internet and cost something real:
POST /v1/admin/auth/login burns 240,000 PBKDF2 rounds per guess, and
POST /v1/auth/otp/send spends money at Eskiz and puts a DUYO-branded SMS on
somebody's phone. The per-phone OTP counter in services/otp.py bounded
neither, because neither is keyed on a phone number the attacker owns.

Fixed window, not a token bucket: two INCRs and an EXPIRE, no Lua, no clock
skew to reason about. A caller can get 2x the limit across a window boundary,
which for "stop the script, not the one determined human" is fine.

FAILS OPEN. A limiter is not an authenticator, and a Redis outage that locks
every admin out of the panel and every family out of login is a worse
incident than the burst it would have stopped. The failure is logged loudly
so it is visible rather than silent.
"""

from __future__ import annotations

import logging

from fastapi import Request

from duyo.core.redis import get_redis

log = logging.getLogger(__name__)


class RateLimited(Exception):
    """Raised when a caller has spent its allowance for the current window."""


def client_ip(request: Request | None) -> str:
    """The caller's address as nginx reports it, or "unknown".

    X-Real-IP, not X-Forwarded-For. The playbook's nginx sets X-Real-IP to
    $remote_addr — a value the client cannot influence — while
    X-Forwarded-For is $proxy_add_x_forwarded_for, which APPENDS to whatever
    header the client sent. Keying a limiter on the client's own first entry
    would let one attacker mint a fresh allowance per request.
    """
    if request is None:
        return "unknown"
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    return request.client.host if request.client else "unknown"


async def hit(bucket: str, identity: str, *, limit: int, window_seconds: int) -> None:
    """Count one attempt against (bucket, identity). Raises RateLimited past `limit`."""
    key = f"ratelimit:{bucket}:{identity}"
    try:
        redis = get_redis()
        count = await redis.incr(key)
        if count == 1:
            await redis.expire(key, window_seconds)
    except Exception:
        # See the module docstring: open, and loud.
        log.error("rate limiter unavailable — %s is unthrottled this request", bucket)
        return
    if count > limit:
        raise RateLimited(f"Too many attempts for {bucket}")


__all__ = ["RateLimited", "client_ip", "hit"]
