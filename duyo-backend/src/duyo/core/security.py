"""JWT token encode/decode.

MVP uses phone + OTP authentication — no passwords, no password hashing.
If passwords are added later, use the `bcrypt` library directly (passlib
has compatibility issues with bcrypt 4.x).
"""

from datetime import UTC, datetime, timedelta
from typing import Any, Literal

from jose import JWTError, jwt

from duyo.core.config import get_settings

TokenType = Literal["access", "refresh"]


def create_token(
    subject: str,
    token_type: TokenType,
    extra_claims: dict[str, Any] | None = None,
) -> str:
    settings = get_settings()
    now = datetime.now(UTC)
    if token_type == "access":
        expire = now + timedelta(minutes=settings.jwt_access_token_expire_minutes)
    else:
        expire = now + timedelta(days=settings.jwt_refresh_token_expire_days)

    claims: dict[str, Any] = {
        "sub": subject,
        "type": token_type,
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    }
    if extra_claims:
        claims.update(extra_claims)

    return jwt.encode(claims, settings.app_secret_key, algorithm=settings.jwt_algorithm)


def decode_token(token: str, expected_type: TokenType | None = None) -> dict[str, Any]:
    """Decode and validate JWT. Raises ValueError on any failure."""
    settings = get_settings()
    try:
        claims = jwt.decode(token, settings.app_secret_key, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:
        raise ValueError(f"Invalid token: {exc}") from exc

    if expected_type and claims.get("type") != expected_type:
        raise ValueError(f"Wrong token type: expected {expected_type}, got {claims.get('type')}")

    return claims
