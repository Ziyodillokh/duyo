"""Admin user management (RBAC CRUD) — create/update/reset + lockout guards."""

import asyncio
from dataclasses import dataclass, field
from datetime import UTC, datetime
from uuid import uuid4

import pytest
from fastapi import HTTPException

from duyo.api.v1 import admin as admin_api
from duyo.models.admin import AdminRole, AdminUser


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


@dataclass
class _FakeSession:
    scalars_queue: list = field(default_factory=list)
    added: list = field(default_factory=list)
    flushed: bool = False

    async def scalar(self, *_a, **_kw):
        return self.scalars_queue.pop(0)

    def add(self, obj):
        self.added.append(obj)

    async def flush(self):
        # Real DB populates id + created_at server-side on flush; mimic that so
        # AdminUserRow.model_validate on a freshly-created admin succeeds.
        self.flushed = True
        for o in self.added:
            if isinstance(o, AdminUser):
                if getattr(o, "id", None) is None:
                    o.id = uuid4()
                if getattr(o, "created_at", None) is None:
                    o.created_at = datetime.now(UTC)
                if getattr(o, "last_login_at", "unset") == "unset":
                    o.last_login_at = None


@dataclass
class _Req:
    client = None


def _admin(role=AdminRole.SUPER_ADMIN, **kw) -> AdminUser:
    a = AdminUser(
        email=kw.get("email", "boss@duyo.uz"),
        password_hash="x", full_name=kw.get("full_name", "Boss"),
        role=role, is_active=kw.get("is_active", True),
    )
    a.id = kw.get("id", uuid4())
    a.last_login_at = None
    a.created_at = datetime.now(UTC)  # server_default in DB; set here for model_validate
    return a


# ── Create ───────────────────────────────────────────────────────────────────

def test_create_admin_hashes_password():
    current = _admin()
    db = _FakeSession(scalars_queue=[None])  # email lookup → not taken
    payload = admin_api.CreateAdminRequest(
        email="New@Duyo.UZ", full_name="New One", role=AdminRole.SUPPORT_AGENT, password="secret123",
    )
    row = _run(admin_api.create_admin(payload=payload, request=_Req(), db=db, current=current))
    created = next(a for a in db.added if isinstance(a, AdminUser))
    assert created.email == "new@duyo.uz"              # normalized
    assert created.password_hash != "secret123"        # hashed, not plaintext
    assert created.password_hash.startswith("pbkdf2_sha256$")
    assert row.role == AdminRole.SUPPORT_AGENT


def test_create_admin_duplicate_email_409():
    current = _admin()
    db = _FakeSession(scalars_queue=[_admin(email="dup@duyo.uz")])
    payload = admin_api.CreateAdminRequest(
        email="dup@duyo.uz", role=AdminRole.ANALYST, password="secret123",
    )
    with pytest.raises(HTTPException) as exc:
        _run(admin_api.create_admin(payload=payload, request=_Req(), db=db, current=current))
    assert exc.value.status_code == 409


def test_create_admin_bad_email_400():
    current = _admin()
    db = _FakeSession(scalars_queue=[])
    payload = admin_api.CreateAdminRequest(
        email="notanemail", role=AdminRole.ANALYST, password="secret123",
    )
    with pytest.raises(HTTPException) as exc:
        _run(admin_api.create_admin(payload=payload, request=_Req(), db=db, current=current))
    assert exc.value.status_code == 400


def test_create_admin_short_password_rejected_at_schema():
    with pytest.raises(ValueError):
        admin_api.CreateAdminRequest(email="a@b.uz", role=AdminRole.ANALYST, password="short")


# ── Update ───────────────────────────────────────────────────────────────────

def test_update_role_applied():
    current = _admin()
    target = _admin(role=AdminRole.ANALYST, email="t@duyo.uz")
    db = _FakeSession(scalars_queue=[target])
    payload = admin_api.UpdateAdminRequest(role=AdminRole.CONTENT_MANAGER)
    row = _run(admin_api.update_admin(
        admin_id=target.id, payload=payload, request=_Req(), db=db, current=current,
    ))
    assert row.role == AdminRole.CONTENT_MANAGER


def test_cannot_self_demote():
    current = _admin()
    db = _FakeSession(scalars_queue=[current])  # target == current
    payload = admin_api.UpdateAdminRequest(role=AdminRole.ADMIN)
    with pytest.raises(HTTPException) as exc:
        _run(admin_api.update_admin(
            admin_id=current.id, payload=payload, request=_Req(), db=db, current=current,
        ))
    assert exc.value.status_code == 400


def test_cannot_self_deactivate():
    current = _admin()
    db = _FakeSession(scalars_queue=[current])
    payload = admin_api.UpdateAdminRequest(is_active=False)
    with pytest.raises(HTTPException) as exc:
        _run(admin_api.update_admin(
            admin_id=current.id, payload=payload, request=_Req(), db=db, current=current,
        ))
    assert exc.value.status_code == 400


def test_cannot_demote_last_super_admin():
    current = _admin()
    other_super = _admin(role=AdminRole.SUPER_ADMIN, email="other@duyo.uz")
    # target lookup → other_super; active super count → 1
    db = _FakeSession(scalars_queue=[other_super, 1])
    payload = admin_api.UpdateAdminRequest(role=AdminRole.ADMIN)
    with pytest.raises(HTTPException) as exc:
        _run(admin_api.update_admin(
            admin_id=other_super.id, payload=payload, request=_Req(), db=db, current=current,
        ))
    assert exc.value.status_code == 400


def test_can_demote_super_admin_when_others_exist():
    current = _admin()
    other_super = _admin(role=AdminRole.SUPER_ADMIN, email="other@duyo.uz")
    db = _FakeSession(scalars_queue=[other_super, 2])  # 2 active supers → allowed
    payload = admin_api.UpdateAdminRequest(role=AdminRole.ADMIN)
    row = _run(admin_api.update_admin(
        admin_id=other_super.id, payload=payload, request=_Req(), db=db, current=current,
    ))
    assert row.role == AdminRole.ADMIN


# ── Reset password ─────────────────────────────────────────────────────────────

def test_reset_password_changes_hash():
    current = _admin()
    target = _admin(role=AdminRole.ANALYST, email="t@duyo.uz")
    old_hash = target.password_hash
    db = _FakeSession(scalars_queue=[target])
    out = _run(admin_api.reset_admin_password(
        admin_id=target.id, payload=admin_api.ResetPasswordRequest(password="brandnew123"),
        request=_Req(), db=db, current=current,
    ))
    assert out == {"ok": True}
    assert target.password_hash != old_hash
    assert target.password_hash.startswith("pbkdf2_sha256$")


def test_update_missing_admin_404():
    current = _admin()
    db = _FakeSession(scalars_queue=[None])
    with pytest.raises(HTTPException) as exc:
        _run(admin_api.update_admin(
            admin_id=uuid4(), payload=admin_api.UpdateAdminRequest(full_name="X"),
            request=_Req(), db=db, current=current,
        ))
    assert exc.value.status_code == 404
