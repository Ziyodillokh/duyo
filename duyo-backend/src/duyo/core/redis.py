"""The process's one Redis client.

It lived in services/otp.py, which was fine while OTP was the only thing that
needed Redis. Rate limiting and refresh-token rotation need it too, and none
of them should reach into an unrelated service module — or open a second
connection pool — to get it.
"""

from __future__ import annotations

from functools import lru_cache

import redis.asyncio as aioredis

from duyo.core.config import get_settings


@lru_cache
def get_redis() -> aioredis.Redis:
    return aioredis.from_url(get_settings().redis_url, decode_responses=True)


__all__ = ["get_redis"]
