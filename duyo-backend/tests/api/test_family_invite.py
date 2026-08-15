"""Family invite: parent enters a child's phone, a login code goes out to it.

send_otp runs for real here (against the demo-code bypass, same as
test_auth_signup.py) rather than being mocked — what matters is that
create_invite reaches it at all and that the invite record itself is
written/deduplicated correctly.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from fastapi import HTTPException

from duyo.api.v1 import family as family_module
from duyo.core.config import get_settings
from duyo.models.child import AgeSegment, ChildProfile, Language
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
    """scalar() answers by what the query selects.

    select(FamilyInvite) -> existing_invite
    select(ChildProfile) -> existing_child (default None = account has none)
    """

    existing_invite: FamilyInvite | None = None
    existing_child: ChildProfile | None = None
    added: list = field(default_factory=list)
    committed: int = 0
    flushed: int = 0
    refreshed: list = field(default_factory=list)

    async def scalar(self, stmt, *_a, **_kw):
        entity = stmt.column_descriptions[0]["entity"]
        if entity is ChildProfile:
            return self.existing_child
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
    phone: str = "+998900000000"


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


# ── an invite is an OFFER; only the invitee can turn it into a link ─────────
#
# child_phone is a number typed by whoever invited, and nothing proves they
# know its owner. Accepting has to be a deliberate act by the person holding
# that phone, or typing a stranger's number is enough to become the recorded
# parent of their profile.

def _open_invite(parent_id=None, child_phone="+998907654321") -> FamilyInvite:
    invite = FamilyInvite(
        parent_id=parent_id or uuid4(), child_name="Aziza",
        child_phone=child_phone, claimed=False,
    )
    invite.id = uuid4()
    invite.expires_at = datetime.now(UTC) + timedelta(hours=24)
    invite.declined_at = None
    return invite


def test_accept_links_the_invite_to_the_accepting_account():
    child = _User(uuid4(), phone="+998907654321")
    invite = _open_invite()
    db = _FakeSession(existing_invite=invite)

    out = _run(family_module.accept_invite(current_user=child, db=db))

    assert out.claimed is True
    assert out.claimed_by_user_id == child.id
    assert out.claimed_at is not None
    assert db.committed == 1


def test_decline_kills_the_offer_without_linking():
    child = _User(uuid4(), phone="+998907654321")
    invite = _open_invite()
    db = _FakeSession(existing_invite=invite)

    out = _run(family_module.decline_invite(current_user=child, db=db))

    assert out.declined_at is not None
    assert out.claimed is False
    assert out.claimed_by_user_id is None


@pytest.mark.parametrize(
    "mutate, why",
    [
        (lambda i: setattr(i, "claimed", True), "already accepted"),
        (lambda i: setattr(i, "declined_at", datetime.now(UTC)), "already declined"),
        (
            lambda i: setattr(i, "expires_at", datetime.now(UTC) - timedelta(seconds=1)),
            "expired",
        ),
    ],
)
def test_a_closed_offer_cannot_be_accepted(mutate, why):
    """Guarded by the query itself, so a stale offer is simply not found."""
    child = _User(uuid4(), phone="+998907654321")
    invite = _open_invite()
    mutate(invite)
    # The real query filters these out; the fake mirrors that.
    db = _FakeSession(existing_invite=None if not invite.is_open() else invite)

    with pytest.raises(HTTPException) as exc:
        _run(family_module.accept_invite(current_user=child, db=db))
    assert exc.value.status_code == 404, why


def test_accepting_when_nothing_was_offered_is_404():
    child = _User(uuid4(), phone="+998907654321")
    db = _FakeSession(existing_invite=None)

    with pytest.raises(HTTPException) as exc:
        _run(family_module.accept_invite(current_user=child, db=db))
    assert exc.value.status_code == 404


# ── accepting when the invitee ALREADY has a profile ────────────────────────
#
# create_child is the only other consumer of a claimed invite, and an account
# that already has a profile never reaches it — the app routes it straight to
# the tabs. Without linking here the accept is a no-op and the inviting
# parent polls forever on a screen that cannot tell "not yet" from "never".

def _self_onboarded_child(owner_id) -> ChildProfile:
    child = ChildProfile(
        id=uuid4(), parent_id=owner_id, name="Aziza", age=12,
        age_segment=AgeSegment.EXPLORER, language=Language.UZ,
    )
    child.child_user_id = None
    return child


def test_accepting_reparents_a_profile_the_invitee_already_had():
    child_acct = _User(uuid4(), phone="+998907654321")
    invite = _open_invite()
    existing = _self_onboarded_child(child_acct.id)
    db = _FakeSession(existing_invite=invite, existing_child=existing)

    _run(family_module.accept_invite(current_user=child_acct, db=db))

    assert existing.parent_id == invite.parent_id      # now the parent's
    assert existing.child_user_id == child_acct.id     # still their own login
    assert invite.claimed is True


def test_accepting_is_refused_when_already_linked_to_another_family():
    """One family at a time — silently re-parenting would move a child's
    whole history out from under the parent who currently has it."""
    child_acct = _User(uuid4(), phone="+998907654321")
    already = _self_onboarded_child(uuid4())
    already.child_user_id = child_acct.id  # linked to someone else already
    db = _FakeSession(existing_invite=_open_invite(), existing_child=already)

    with pytest.raises(HTTPException) as exc:
        _run(family_module.accept_invite(current_user=child_acct, db=db))
    assert exc.value.status_code == 409


# ── self-invite ─────────────────────────────────────────────────────────────

def test_a_parent_cannot_invite_their_own_number():
    """It would make the account its own child and cap it at one profile."""
    parent = _User(uuid4(), phone="+998901234567")
    db = _FakeSession(existing_invite=None)

    with pytest.raises(HTTPException) as exc:
        _run(family_module.create_invite(
            payload=FamilyInviteCreate(child_name="O'zim", child_phone="+998901234567"),
            current_user=parent, db=db,
        ))
    assert exc.value.status_code == 400
    assert db.added == []


# ── re-inviting reopens the offer ───────────────────────────────────────────

def test_resubmitting_clears_a_refusal_and_restarts_the_clock():
    """A parent who sends again is making a NEW offer, not reviving the old one."""
    parent = _User(uuid4())
    stale = _open_invite(parent_id=parent.id)
    stale.declined_at = datetime.now(UTC) - timedelta(hours=1)
    stale.expires_at = datetime.now(UTC) - timedelta(hours=1)
    db = _FakeSession(existing_invite=stale)

    out = _run(family_module.create_invite(
        payload=FamilyInviteCreate(child_name="Aziza", child_phone="+998907654321"),
        current_user=parent, db=db,
    ))

    assert out.declined_at is None
    assert out.expires_at > datetime.now(UTC)
    assert out.is_open()
