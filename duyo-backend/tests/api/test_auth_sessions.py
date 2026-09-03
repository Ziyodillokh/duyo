"""Revocation: logout, refresh rotation, and reuse detection.

Before this, "log out" was a client-side erase and a refresh token was a
renewable 30-day session that nobody could end and nobody could see. These pin
the three properties that changed: a token names the generation it was minted
under, logout moves that generation, and a refresh token spends exactly once.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from uuid import uuid4

import pytest
from fastapi import HTTPException

from duyo.api import deps
from duyo.api.v1 import auth as auth_module
from duyo.core.security import create_token, decode_token, is_current
from duyo.models.user import User
from duyo.schemas.auth import RefreshRequest


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


@dataclass
class _FakeSession:
    user: User | None
    committed: int = 0
    deleted: list = field(default_factory=list)

    async def scalar(self, *_a, **_kw):
        return self.user

    async def commit(self):
        self.committed += 1


@pytest.fixture(autouse=True)
def _spent_tokens(monkeypatch):
    """An in-memory stand-in for the Redis set of spent refresh jtis."""
    spent: set[str] = set()

    async def _was_spent(jti):
        return jti in spent

    async def _mark_spent(jti, _ttl):
        spent.add(jti)

    monkeypatch.setattr(auth_module.token_revocation, "was_spent", _was_spent)
    monkeypatch.setattr(auth_module.token_revocation, "mark_spent", _mark_spent)
    return spent


def _user(token_version: int = 0) -> User:
    user = User(phone="+998901234567", token_version=token_version)
    user.id = uuid4()
    return user


# ── the claims themselves ───────────────────────────────────────────────────

def test_a_token_names_its_generation_and_itself():
    claims = decode_token(create_token("abc", "access", token_version=3))
    assert claims["tv"] == 3
    assert claims["jti"]


def test_two_tokens_minted_together_are_still_distinguishable():
    """Rotation has to name the token it retires; iat alone cannot."""
    a = decode_token(create_token("abc", "refresh"))
    b = decode_token(create_token("abc", "refresh"))
    assert a["jti"] != b["jti"]


def test_a_token_from_before_the_claim_existed_still_works():
    """Shipping revocation must not sign the whole installed base out."""
    assert is_current({"sub": "abc", "type": "access"}, 0) is True


def test_a_stale_generation_is_not_current():
    assert is_current({"tv": 1}, 2) is False


# ── logout ──────────────────────────────────────────────────────────────────

def test_logout_moves_the_generation_and_commits():
    user = _user()
    db = _FakeSession(user)
    _run(auth_module.logout(current_user=user, db=db))
    assert user.token_version == 1
    assert db.committed == 1


# ── refresh ─────────────────────────────────────────────────────────────────

def test_refresh_returns_a_pair_bound_to_the_current_generation():
    user = _user(token_version=4)
    token = create_token(str(user.id), "refresh", token_version=4)
    body = _run(
        auth_module.refresh(payload=RefreshRequest(refresh_token=token), db=_FakeSession(user))
    )
    assert decode_token(body.access_token)["tv"] == 4
    assert decode_token(body.refresh_token)["jti"] != decode_token(token)["jti"]


def test_a_token_from_before_a_logout_is_refused():
    user = _user(token_version=1)
    token = create_token(str(user.id), "refresh", token_version=0)
    with pytest.raises(HTTPException) as exc:
        _run(
            auth_module.refresh(
                payload=RefreshRequest(refresh_token=token), db=_FakeSession(user)
            )
        )
    assert exc.value.status_code == 401


def test_a_refresh_token_spends_once():
    """A second presentation can only mean two holders — end every session."""
    user = _user()
    token = create_token(str(user.id), "refresh")
    db = _FakeSession(user)
    _run(auth_module.refresh(payload=RefreshRequest(refresh_token=token), db=db))

    with pytest.raises(HTTPException) as exc:
        _run(auth_module.refresh(payload=RefreshRequest(refresh_token=token), db=db))
    assert exc.value.status_code == 401
    assert user.token_version == 1


def test_a_deleted_account_cannot_refresh_its_way_back():
    token = create_token(str(uuid4()), "refresh")
    with pytest.raises(HTTPException) as exc:
        _run(
            auth_module.refresh(
                payload=RefreshRequest(refresh_token=token), db=_FakeSession(None)
            )
        )
    assert exc.value.status_code == 401


# ── the access path ─────────────────────────────────────────────────────────

def test_an_access_token_from_before_a_logout_is_refused():
    """Revocation only means something if the ordinary request path checks it."""
    user = _user(token_version=2)
    token = create_token(str(user.id), "access", token_version=1)
    with pytest.raises(HTTPException) as exc:
        _run(deps.get_current_user(authorization=f"Bearer {token}", db=_FakeSession(user)))
    assert exc.value.status_code == 401


def test_a_current_access_token_still_resolves():
    user = _user(token_version=2)
    token = create_token(str(user.id), "access", token_version=2)
    assert _run(
        deps.get_current_user(authorization=f"Bearer {token}", db=_FakeSession(user))
    ) is user
