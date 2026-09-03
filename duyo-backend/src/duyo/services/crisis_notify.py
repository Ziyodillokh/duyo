"""Who a crisis alert is allowed to reach.

The crisis path used to resolve its recipient as "the profile's owner, and if
that owner is the account currently chatting, that account's own phone". Under
the family model this file exists for, the owner is the parent and the chatting
account is the child's linked login, so that rule read correctly.

It is not the shape production is in. A ChildProfile only gets a `child_user_id`
when a FamilyInvite has been claimed, and no route creates or accepts an invite
— `POST /v1/family/invite/accept` is named in auth.py's comment but no family
router is registered in api/v1/__init__.py. So `parent_id` is the account that
walked through onboarding, and the app's onboarding is the child's own
(otp.tsx and first-conversation.tsx both PATCH `role: 'child'`). The owner and
the child were the same person, every time, and the alert that privacy.html and
terms.html promise goes to a trusted adult was a text message telling a child in
distress about their own distress.

So the rule here is structural, not declared: a crisis SMS may go out only to a
User row that is provably somebody other than the account holding the phone.
`User.role` is deliberately not consulted — the client writes it, it writes the
same value for everyone, and a field the app controls cannot be the thing that
decides whether a child gets texted about their own crisis.

When there is no such row the SMS is suppressed rather than redirected. The
child still gets the crisis screen and the helpline; the event is left
`parent_notified=False` so it stands out in the admin safety queue, which has a
human "notify parent" action for exactly this case.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from duyo.models.child import ChildProfile
from duyo.models.user import User


async def resolve_trusted_adult_phone(
    session: AsyncSession, child: ChildProfile, acting_user: User
) -> str | None:
    """The phone a crisis alert may be sent to, or None when there isn't one.

    None is the honest answer for every profile that was created and is used by
    one and the same account, which today is all of them.
    """
    owner_id = child.parent_id
    # Two ways the "parent" is the child: the profile is self-owned (no invite
    # was ever claimed), or the linked child account IS the owner — which a
    # self-addressed invite would produce, since a phone number is one User row.
    if owner_id == acting_user.id or owner_id == child.child_user_id:
        return None

    phone = await session.scalar(select(User.phone).where(User.id == owner_id))
    # The phone comparison is redundant while `users.phone` is unique, and cheap
    # enough to keep as the last line of defence: this is the one place in the
    # product where being wrong means texting a child about their own crisis.
    if not phone or phone == acting_user.phone:
        return None
    return phone
