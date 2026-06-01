from datetime import UTC, datetime, timedelta

import pytest
from jose import JWTError, jwt

from duyo.core.admin_security import (
    create_admin_token,
    decode_admin_token,
    hash_password,
    verify_password,
)
from duyo.core.config import get_settings


def test_password_hash_roundtrip():
    h = hash_password("S3cret-pass!")
    assert h.startswith("pbkdf2_sha256$")
    assert verify_password("S3cret-pass!", h) is True
    assert verify_password("wrong", h) is False


def test_password_hash_is_salted():
    # Same password → different stored hash (random salt).
    assert hash_password("same") != hash_password("same")


def test_verify_handles_malformed_stored():
    assert verify_password("x", "not-a-valid-hash") is False
    assert verify_password("x", "") is False


def test_admin_token_roundtrip():
    token = create_admin_token("abc-123", "safety_officer")
    claims = decode_admin_token(token)
    assert claims["sub"] == "abc-123"
    assert claims["role"] == "safety_officer"
    assert claims["type"] == "admin"


def test_decode_rejects_non_admin_token():
    # A parent/child token (type != "admin") must be rejected.
    s = get_settings()
    now = datetime.now(UTC)
    parent_token = jwt.encode(
        {"sub": "u1", "type": "access", "exp": int((now + timedelta(hours=1)).timestamp())},
        s.app_secret_key,
        algorithm=s.jwt_algorithm,
    )
    with pytest.raises(JWTError):
        decode_admin_token(parent_token)
