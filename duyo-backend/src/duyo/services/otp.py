"""OTP generation, storage (Redis), and verification.

Per TZ §6.2 — 4-digit numeric code, 5 minute TTL, max 5 verify attempts,
max 10 sends/phone/hour.
"""

from __future__ import annotations

import secrets
from functools import lru_cache

import redis.asyncio as aioredis

from duyo.core.config import get_settings


def _otp_key(phone: str) -> str:
    return f"otp:code:{phone}"


def _attempts_key(phone: str) -> str:
    return f"otp:attempts:{phone}"


def _rate_key(phone: str) -> str:
    return f"otp:rate:{phone}"


@lru_cache
def get_redis() -> aioredis.Redis:
    return aioredis.from_url(get_settings().redis_url, decode_responses=True)


def generate_code(length: int) -> str:
    """Cryptographically random numeric code of given length."""
    upper = 10**length
    return str(secrets.randbelow(upper)).zfill(length)


class OTPRateLimited(Exception):
    """Raised when the per-hour send limit is exceeded."""


class OTPInvalid(Exception):
    """Raised when verify fails (wrong code, expired, no attempts left)."""


def _test_numbers() -> dict[str, str]:
    """Parse OTP_TEST_NUMBERS ("phone:code,phone:code") into a {phone: code} map."""
    raw = get_settings().otp_test_numbers or ""
    out: dict[str, str] = {}
    for pair in raw.split(","):
        pair = pair.strip()
        if ":" in pair:
            phone, code = pair.split(":", 1)
            if phone.strip() and code.strip():
                out[phone.strip()] = code.strip()
    return out


async def issue(phone: str) -> str:
    """Generate, store, and return a new OTP for `phone`.

    Caller is responsible for sending the code via SMS.
    """
    # Test phones bypass SMS entirely — return the fixed code (verify accepts it).
    if phone in _test_numbers():
        return _test_numbers()[phone]

    settings = get_settings()
    redis = get_redis()

    # Rate limit
    rate_count = await redis.incr(_rate_key(phone))
    if rate_count == 1:
        await redis.expire(_rate_key(phone), 3600)
    if rate_count > settings.otp_rate_limit_per_phone_per_hour:
        raise OTPRateLimited(f"Too many OTP requests for {phone}")

    code = generate_code(settings.otp_length)
    await redis.set(_otp_key(phone), code, ex=settings.otp_ttl_seconds)
    await redis.delete(_attempts_key(phone))
    return code


async def verify(phone: str, code: str) -> bool:
    """Return True if `code` matches the active OTP. Consumes the OTP on success."""
    # Test phones accept their fixed code directly (no Redis / SMS).
    test_numbers = _test_numbers()
    if phone in test_numbers:
        return secrets.compare_digest(test_numbers[phone], code)

    settings = get_settings()
    redis = get_redis()

    attempts = await redis.incr(_attempts_key(phone))
    if attempts == 1:
        await redis.expire(_attempts_key(phone), settings.otp_ttl_seconds)
    if attempts > settings.otp_max_attempts:
        await redis.delete(_otp_key(phone))
        raise OTPInvalid("Too many attempts")

    stored = await redis.get(_otp_key(phone))
    if stored is None:
        raise OTPInvalid("OTP expired or never issued")
    if not secrets.compare_digest(stored, code):
        return False

    # Success — clean up so the code can't be reused
    await redis.delete(_otp_key(phone), _attempts_key(phone))
    return True
