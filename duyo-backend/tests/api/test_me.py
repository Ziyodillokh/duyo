"""GET/PATCH /v1/me — the account behind the phone number."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from datetime import UTC, datetime
from uuid import uuid4

from duyo.api.v1 import me as me_module
from duyo.models.child import AgeSegment, ChildProfile, Language
from duyo.models.user import AccountRole, User
from duyo.schemas.me import AccountUpdate


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


@dataclass
class _FakeSession:
    committed: int = 0
    refreshed: list = field(default_factory=list)

    async def commit(self):
        self.committed += 1

    async def refresh(self, obj):
        self.refreshed.append(obj)


def _user(children: int = 0, **kw) -> User:
    user = User(phone=kw.pop("phone", "+998901234567"), **kw)
    user.id = uuid4()
    # created_at is a server default in Postgres; set it by hand for a row
    # that never reached the database.
    user.created_at = datetime(2026, 8, 2, tzinfo=UTC)
    user.children = [
        ChildProfile(
            parent_id=user.id,
            name=f"Bola {n}",
            age=10,
            age_segment=AgeSegment.JUNIOR,
            language=Language.UZ,
        )
        for n in range(children)
    ]
    return user


def test_read_me_reports_the_account():
    user = _user(role=AccountRole.PARENT, display_name="Dilnoza")
    body = _run(me_module.read_me(current_user=user))
    assert body.phone == "+998901234567"
    assert body.role == AccountRole.PARENT
    assert body.display_name == "Dilnoza"
    assert body.children_count == 0


def test_read_me_counts_children():
    """The app uses this to tell "resume" from "onboard" in one call."""
    assert _run(me_module.read_me(current_user=_user(children=2))).children_count == 2


def test_patch_stores_role_and_name():
    user = _user()
    db = _FakeSession()
    body = _run(
        me_module.update_me(
            payload=AccountUpdate(role=AccountRole.PARENT, display_name="Dilnoza"),
            current_user=user,
            db=db,
        )
    )
    assert body.role == AccountRole.PARENT
    assert body.display_name == "Dilnoza"
    assert db.committed == 1


def test_patch_leaves_absent_fields_alone():
    """Onboarding re-sends this on every login; it must not wipe what is there."""
    user = _user(role=AccountRole.CHILD, display_name="Bek")
    _run(me_module.update_me(payload=AccountUpdate(), current_user=user, db=_FakeSession()))
    assert user.role == AccountRole.CHILD
    assert user.display_name == "Bek"


def test_patch_treats_a_blank_name_as_no_name():
    user = _user(display_name="Bek")
    _run(
        me_module.update_me(
            payload=AccountUpdate(display_name="   "), current_user=user, db=_FakeSession()
        )
    )
    assert user.display_name is None


def test_patch_strips_the_name():
    user = _user()
    _run(
        me_module.update_me(
            payload=AccountUpdate(display_name="  Dilnoza "),
            current_user=user,
            db=_FakeSession(),
        )
    )
    assert user.display_name == "Dilnoza"
