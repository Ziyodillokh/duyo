"""A crisis SMS may never be delivered to the child it is about.

The old rule fell back to `current_user.phone` whenever the profile's owner was
the account chatting. Every profile in production is in exactly that state —
onboarding creates the profile from the child's own account, and no route
exists to create or claim the FamilyInvite that would introduce a second one —
so "we notify a trusted adult", which privacy.html and terms.html both say,
delivered a text about a child's self-harm signal to that child's handset.

These tests pin the replacement rule: a recipient has to be provably somebody
else, and when there is nobody the send is suppressed rather than redirected.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from uuid import UUID, uuid4

from duyo.services.crisis_notify import resolve_trusted_adult_phone


def _run(coro):
    return asyncio.run(coro)


@dataclass
class _Session:
    """Answers the one `SELECT users.phone WHERE id = :owner` this makes."""

    phones: dict[UUID, str] = field(default_factory=dict)
    queries: int = 0

    async def scalar(self, stmt):
        self.queries += 1
        # The statement binds exactly one parameter: the owner id being looked up.
        owner_id = next(iter(stmt.compile().params.values()))
        return self.phones.get(owner_id)


@dataclass
class _User:
    id: UUID
    phone: str


@dataclass
class _Child:
    parent_id: UUID
    child_user_id: UUID | None = None


def test_a_self_owned_profile_has_no_trusted_adult():
    """The shape of every account in production today."""
    child_account = _User(uuid4(), "+998901112233")
    child = _Child(parent_id=child_account.id)
    session = _Session()

    phone = _run(resolve_trusted_adult_phone(session, child, child_account))

    assert phone is None
    # And it did not even ask the database whose number to use.
    assert session.queries == 0


def test_a_linked_parent_is_reached_on_their_own_number():
    parent = _User(uuid4(), "+998907654321")
    child_account = _User(uuid4(), "+998901112233")
    child = _Child(parent_id=parent.id, child_user_id=child_account.id)
    session = _Session(phones={parent.id: parent.phone})

    phone = _run(resolve_trusted_adult_phone(session, child, child_account))

    assert phone == parent.phone


def test_an_owner_who_is_the_linked_child_is_not_a_trusted_adult():
    """A self-addressed invite: one phone number is one User row."""
    child_account = _User(uuid4(), "+998901112233")
    child = _Child(parent_id=child_account.id, child_user_id=child_account.id)
    session = _Session(phones={child_account.id: child_account.phone})

    assert _run(resolve_trusted_adult_phone(session, child, child_account)) is None


def test_a_separate_owner_row_carrying_the_childs_own_number_is_refused():
    """Distinct ids, same handset — the number is what the SMS reaches."""
    child_account = _User(uuid4(), "+998901112233")
    owner_id = uuid4()
    child = _Child(parent_id=owner_id, child_user_id=child_account.id)
    session = _Session(phones={owner_id: child_account.phone})

    assert _run(resolve_trusted_adult_phone(session, child, child_account)) is None


def test_an_owner_with_no_phone_on_file_suppresses_rather_than_falls_back():
    child_account = _User(uuid4(), "+998901112233")
    child = _Child(parent_id=uuid4(), child_user_id=child_account.id)
    session = _Session()

    assert _run(resolve_trusted_adult_phone(session, child, child_account)) is None
