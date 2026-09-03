"""JWT token encode/decode.

MVP uses phone + OTP authentication — no passwords, no password hashing.
If passwords are added later, use the `bcrypt` library directly (passlib
has compatibility issues with bcrypt 4.x).
"""

from datetime import UTC, datetime, timedelta
from typing import Any, Literal
from uuid import uuid4

from jose import JWTError, jwt

from duyo.core.config import get_settings

TokenType = Literal["access", "refresh"]


def create_token(
    subject: str,
    token_type: TokenType,
    extra_claims: dict[str, Any] | None = None,
    *,
    token_version: int = 0,
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
        # Names THIS token. Refresh rotation has to say which token it is
        # retiring, and nothing else in the payload distinguishes two tokens
        # minted for the same account in the same second.
        "jti": uuid4().hex,
        # Which session generation the token belongs to; see `is_current`.
        "tv": token_version,
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    }
    if extra_claims:
        claims.update(extra_claims)

    return jwt.encode(claims, settings.app_secret_key, algorithm=settings.jwt_algorithm)


def is_current(claims: dict[str, Any], token_version: int | None) -> bool:
    """Whether this token still belongs to the account's live generation.

    This is the whole of revocation. A JWT cannot be recalled once signed, so
    "log me out everywhere" is instead one number on the user row going up,
    which every token minted before it no longer matches.

    A token issued before the claim existed carries no `tv` and reads as
    generation 0 — which is where every existing account starts — so shipping
    this signs nobody out. A User row that has not been flushed has no
    generation yet for the same reason, and reads as 0 too.
    """
    try:
        return int(claims.get("tv", 0)) == (token_version or 0)
    except (TypeError, ValueError):
        return False


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
