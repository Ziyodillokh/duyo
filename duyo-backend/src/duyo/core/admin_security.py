"""Admin auth primitives — password hashing (stdlib PBKDF2) + admin JWT.

No bcrypt/passlib dependency (avoids the production wheel-list drift): PBKDF2-
HMAC-SHA256 with a per-user salt + high iteration count is sufficient for the
small set of internal admin accounts. Admin tokens are a separate JWT "scope"
(`type="admin"`, with a `role` claim) so a parent/child token can never satisfy
an admin dependency.
"""

from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any

from jose import JWTError, jwt

from duyo.core.config import get_settings

_ALGO = "pbkdf2_sha256"
_ITERATIONS = 240_000
_ADMIN_TOKEN_TTL_HOURS = 12


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, _ITERATIONS)
    return f"{_ALGO}${_ITERATIONS}${salt.hex()}${dk.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algo, iterations, salt_hex, hash_hex = stored.split("$")
        if algo != _ALGO:
            return False
        dk = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt_hex), int(iterations))
        return hmac.compare_digest(dk.hex(), hash_hex)
    except (ValueError, AttributeError):
        return False


def create_admin_token(admin_id: str, role: str) -> str:
    settings = get_settings()
    now = datetime.now(UTC)
    claims: dict[str, Any] = {
        "sub": admin_id,
        "type": "admin",
        "role": role,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(hours=_ADMIN_TOKEN_TTL_HOURS)).timestamp()),
    }
    return jwt.encode(claims, settings.app_secret_key, algorithm=settings.jwt_algorithm)


def decode_admin_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    claims = jwt.decode(token, settings.app_secret_key, algorithms=[settings.jwt_algorithm])
    if claims.get("type") != "admin":
        raise JWTError("Not an admin token")
    return claims
