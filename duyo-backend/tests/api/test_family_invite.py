"""Family invite: parent enters a child's phone, a login code goes out to it.

send_otp runs for real here (against the demo-code bypass, same as
test_auth_signup.py) rather than being mocked — what matters is that
create_invite reaches it at all and that the invite record itself is
written/deduplicated correctly.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from uuid import uuid4

import pytest

from duyo.api.v1 import family as family_module
from duyo.core.config import get_settings
from duyo.models.family_invite import FamilyInvite
from duyo.schemas.family import FamilyInviteCreate


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


@pytest.fixture(autouse=True)
def _demo_code_on(monkeypatch):
    monkeypatch.setattr(get_settings(), "otp_test_numbers", "")
    monkeypatch.setattr(get_settings(), "otp_demo_code", "00000")


@dataclass
class _FakeSession:
    existing_invite: FamilyInvite | None = None
    added: list = field(default_factory=list)
    committed: int = 0
    flushed: int = 0
    refreshed: list = field(default_factory=list)

    async def scalar(self, *_a, **_kw):
        return self.existing_invite

    def add(self, obj):
        self.added.append(obj)

    async def flush(self):
        self.flushed += 1

    async def commit(self):
        self.committed += 1

    async def refresh(self, obj):
        self.refreshed.append(obj)


@dataclass
class _User:
    id: object


# ── create_invite ────────────────────────────────────────────────────────────

def test_creates_a_new_invite_when_none_pending():
    parent = _User(uuid4())
    db = _FakeSession(existing_invite=None)

    invite = _run(family_module.create_invite(
        payload=FamilyInviteCreate(child_name="Bekzod", child_phone="+998911112233"),
        current_user=parent, db=db,
    ))

    assert len(db.added) == 1
    assert invite.parent_id == parent.id
    assert invite.child_name == "Bekzod"
    assert invite.child_phone == "+998911112233"
    assert not invite.claimed  # default=False applies at real flush, not here
    assert db.committed == 1


def test_resubmitting_updates_the_pending_invite_instead_of_duplicating():
    """Same fix create_child needed for the identical double-tap problem."""
    parent = _User(uuid4())
    existing = FamilyInvite(
        parent_id=parent.id, child_name="Bek", child_phone="+998900000000", claimed=False,
    )
    existing.id = uuid4()
    db = _FakeSession(existing_invite=existing)

    invite = _run(family_module.create_invite(
        payload=FamilyInviteCreate(child_name="Bekzod", child_phone="+998911112233"),
        current_user=parent, db=db,
    ))

    assert db.added == []  # no duplicate row
    assert invite is existing
    assert invite.child_name == "Bekzod"
    assert invite.child_phone == "+998911112233"


# ── get_invite ───────────────────────────────────────────────────────────────

def test_get_invite_returns_the_latest_one():
    parent = _User(uuid4())
    existing = FamilyInvite(
        parent_id=parent.id, child_name="Bek", child_phone="+998900000000", claimed=True,
    )
    db = _FakeSession(existing_invite=existing)

    result = _run(family_module.get_invite(current_user=parent, db=db))

    assert result is existing


def test_get_invite_returns_none_when_never_sent():
    parent = _User(uuid4())
    db = _FakeSession(existing_invite=None)

    result = _run(family_module.get_invite(current_user=parent, db=db))

    assert result is None
