"""Erasing an account and everything behind it.

Google Play has required both an in-app deletion path and a public web URL
since 31 May 2024. DUYO had neither: the only DELETE routes were per-child,
per-note and per-conversation, so a family could take their data apart piece
by piece and still never be gone.

Three stores have to agree, and only one of them has transactions:

  Postgres  one statement, `DELETE FROM users`. Every table that hangs off a
            family already declares ON DELETE CASCADE, so the rows go with it
            and nothing here has to name them one by one — a list like that is
            a list that silently stops being complete the day someone adds a
            table.
  MinIO     the child's photo and any voice/video note they posted. Read the
            keys BEFORE the delete, remove the objects AFTER it: a crash in
            between leaves unreferenced files in a private bucket, which is a
            cleanup job, while the reverse order leaves a live profile
            pointing at a photo that no longer exists, which is a bug the
            family sees.
  Redis     the OTP code, attempt counter and hourly send budget keyed on the
            phone number. Left behind, the next person to hold that number
            inherits them.

TWO THINGS DELIBERATELY SURVIVE, and both belong in the privacy policy:

  crisis_events are the safety audit trail and are held for seven years
  (models/crisis_event.py). They are DE-IDENTIFIED rather than deleted:
  child_id becomes null, the message they cite is gone, and what remains is
  the detection itself — level, layer, matched keywords, timestamps.

  group_messages by this child stay too, because a deleted account must not
  be able to erase what was said in a room full of other children
  (models/social.py). The sender link is already SET NULL and only the
  pseudonym stays. Their MEDIA does not survive: the transcript is what the
  moderation screen actually judged and is enough of a record, and a
  recording of a deleted child's voice or face is not.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from duyo.core import storage
from duyo.models.child import ChildProfile
from duyo.models.crisis_event import CrisisEvent
from duyo.models.social import GroupMessage
from duyo.models.user import User
from duyo.services import otp

log = logging.getLogger(__name__)


@dataclass(frozen=True)
class DeletionReceipt:
    """What one erasure actually did — the shape the route logs."""

    children: int
    media_objects: int
    crisis_events_retained: int


def _actionable_by(user_id: UUID):
    """Child profiles this account may act as.

    The same predicate as chat.py::_owned_by, restated rather than imported so
    the deletion path does not pull in the chat module's world. A parent may
    erase the profiles they created; a child with their own linked account may
    erase the profile that IS them. Both are the data subject's own request.
    """
    return (ChildProfile.parent_id == user_id) | (ChildProfile.child_user_id == user_id)


async def _media_keys(db: AsyncSession, child_ids: list[UUID]) -> list[str]:
    """Every object in the bucket that belongs to these children."""
    if not child_ids:
        return []
    photos = (
        await db.scalars(
            select(ChildProfile.photo_key).where(
                ChildProfile.id.in_(child_ids), ChildProfile.photo_key.is_not(None)
            )
        )
    ).all()
    notes = (
        await db.scalars(
            select(GroupMessage.media_key).where(
                GroupMessage.sender_child_id.in_(child_ids),
                GroupMessage.media_key.is_not(None),
            )
        )
    ).all()
    return [*photos, *notes]


async def delete_account(db: AsyncSession, user: User) -> DeletionReceipt:
    """Erase `user`, the profiles it can act as, and everything downstream.

    Commits. The caller's token is dead the moment this returns — the row it
    resolves against is gone — so there is nothing left to hand back but a
    204.
    """
    user_id = user.id
    phone = user.phone

    child_ids = list((await db.scalars(select(ChildProfile.id).where(_actionable_by(user_id)))).all())
    media_keys = await _media_keys(db, child_ids)

    retained = 0
    if child_ids:
        # Detach the audit trail before the cascade reaches it. See the module
        # docstring: the record is kept, the person is not.
        result = await db.execute(
            update(CrisisEvent)
            .where(CrisisEvent.child_id.in_(child_ids))
            .values(child_id=None)
        )
        retained = result.rowcount or 0

        # The transcript stays as the moderation record; the recording does not.
        await db.execute(
            update(GroupMessage)
            .where(GroupMessage.sender_child_id.in_(child_ids))
            .values(media_key=None, media_kind=None, media_duration_ms=None)
        )

        # A child who claimed their own login (FamilyInvite) has a second User
        # row holding their phone number. It exists only as a way into this
        # family, so leaving it behind would mean an erasure request that left
        # a child's phone number in the database.
        linked = (
            await db.scalars(
                select(User).where(
                    User.id.in_(
                        select(ChildProfile.child_user_id).where(
                            ChildProfile.id.in_(child_ids),
                            ChildProfile.child_user_id.is_not(None),
                            ChildProfile.child_user_id != user_id,
                        )
                    )
                )
            )
        ).all()
        for account in linked:
            await otp.purge(account.phone)
            await db.delete(account)

    await db.delete(user)
    await db.commit()

    await otp.purge(phone)
    for key in media_keys:
        try:
            storage.remove(key)
        except Exception:
            # The rows are already gone and the account is erased. An
            # unreachable bucket leaves orphans nothing points at, which is a
            # cleanup job — not a reason to tell the family the deletion
            # failed and have them try again on an account that no longer
            # exists.
            log.warning("account deletion could not remove a media object")

    log.info(
        "account deleted user=%s children=%d media=%d crisis_retained=%d",
        user_id, len(child_ids), len(media_keys), retained,
    )
    return DeletionReceipt(
        children=len(child_ids),
        media_objects=len(media_keys),
        crisis_events_retained=retained,
    )


__all__ = ["DeletionReceipt", "delete_account"]
