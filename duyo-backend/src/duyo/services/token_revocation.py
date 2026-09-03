"""Refresh-token single use, so a stolen refresh token is visible.

/v1/auth/refresh used to mint a new pair and leave the presented token valid
until its own expiry, which meant a leaked refresh token was a renewable
session nobody could see and nobody could end. Recording each token's `jti`
the first time it is spent turns a second presentation of the same token into
a signal: either the thief refreshed after the owner, or the owner refreshed
after the thief. Both are a compromise, and both end every session on the
account.

Redis, not Postgres: these are short-lived rows that must vanish on their own,
and the refresh path already has to be cheap.

FAILS OPEN, like services/rate_limit.py. Reuse detection is a tripwire, not
the lock; a Redis outage must not sign the whole country out of DUYO on its
next token refresh.
"""

from __future__ import annotations

import logging

from duyo.core.redis import get_redis

log = logging.getLogger(__name__)


def _key(jti: str) -> str:
    return f"refresh:spent:{jti}"


async def was_spent(jti: str) -> bool:
    """True if this exact refresh token has already been exchanged."""
    try:
        return bool(await get_redis().exists(_key(jti)))
    except Exception:
        log.error("refresh reuse detection unavailable — token replay is undetected")
        return False


async def mark_spent(jti: str, ttl_seconds: int) -> None:
    """Remember `jti` for as long as the token it names could still be presented."""
    if ttl_seconds <= 0:
        return
    try:
        await get_redis().set(_key(jti), "1", ex=ttl_seconds)
    except Exception:
        log.error("could not record a spent refresh token — replay is undetected")


__all__ = ["mark_spent", "was_spent"]
