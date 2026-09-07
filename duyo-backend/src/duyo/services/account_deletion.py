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

from sqlalchemy import delete as sa_delete
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


def _remove_media(keys: list[str]) -> None:
    """Drop the bucket objects, after the rows that named them are gone."""
    for key in keys:
        try:
            storage.remove(key)
        except Exception:
            # The rows are already gone and the account is erased. An
            # unreachable bucket leaves orphans nothing points at, which is a
            # cleanup job — not a reason to tell the family the deletion
            # failed and have them try again on an account that no longer
            # exists.
            log.warning("account deletion could not remove a media object")


#: Keys inside `CrisisEvent.matches` that hold prose about the child's message
#: rather than a structured fact about the detection.
_FREE_TEXT_MATCH_KEYS = ("reasoning", "quote", "excerpt")


async def _scrub_crisis_reasoning(db: AsyncSession, child_ids: list[UUID]) -> None:
    """Strip the model's prose from the retained detections.

    Done in Python rather than in SQL: `matches` is a JSONB LIST of objects
    whose shape differs by layer, and a query that edits inside it would have
    to know both shapes and would silently stop covering a third.
    """
    rows = (
        await db.scalars(
            select(CrisisEvent).where(
                CrisisEvent.child_id.in_(child_ids), CrisisEvent.matches.is_not(None)
            )
        )
    ).all()
    for row in rows:
        entries = row.matches or []
        if not isinstance(entries, list):
            continue
        cleaned = [
            {k: v for k, v in entry.items() if k not in _FREE_TEXT_MATCH_KEYS}
            if isinstance(entry, dict)
            else entry
            for entry in entries
        ]
        if cleaned != entries:
            # Reassigned, not mutated in place: SQLAlchemy does not see a
            # change inside a JSON column that was edited element by element.
            row.matches = cleaned

async def _detach(
    db: AsyncSession, child_ids: list[UUID], keep_user_ids: frozenset[UUID]
) -> tuple[list[str], int]:
    """Everything an erasure does to a set of children, short of the delete.

    Split out of `delete_account` because the 13+ age floor needs the same
    work on children whose ACCOUNT survives (scripts/purge_under_13.py). A
    second copy of this would be a copy that stops matching the day one of
    the two is edited, and the half that drifts is the one that leaves a
    deleted child's voice in the bucket.

    `keep_user_ids` are accounts never to remove even if a purged child links
    to them — the family the request came from, or the owner of a sibling
    profile that is staying.

    Returns the keys to remove after the commit, and how many crisis events
    were de-identified. Does NOT commit.
    """
    if not child_ids:
        return [], 0

    media_keys = await _media_keys(db, child_ids)

    # `matches` carries Layer 1's keywords — which are ours — but Layer 2 puts
    # the MODEL'S free-text `reasoning` there, and that prose is written about
    # what the child said and can restate it. The deletion page promises the
    # message text is gone and only the detection remains, so the prose goes
    # with the message. Level, layer, confidence and the matched keywords stay:
    # those are the record.
    #
    # BEFORE the detach below, which is what still ties these rows to a child.
    await _scrub_crisis_reasoning(db, child_ids)

    # Detach the audit trail before the cascade reaches it. See the module
    # docstring: the record is kept, the person is not.
    result = await db.execute(
        update(CrisisEvent).where(CrisisEvent.child_id.in_(child_ids)).values(child_id=None)
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
    where = [
        User.id.in_(
            select(ChildProfile.child_user_id).where(
                ChildProfile.id.in_(child_ids),
                ChildProfile.child_user_id.is_not(None),
            )
        )
    ]
    if keep_user_ids:
        where.append(User.id.notin_(keep_user_ids))
    for account in (await db.scalars(select(User).where(*where))).all():
        await otp.purge(account.phone)
        await db.delete(account)

    return media_keys, retained


async def delete_account(db: AsyncSession, user: User) -> DeletionReceipt:
    """Erase `user`, the profiles it can act as, and everything downstream.

    Commits. The caller's token is dead the moment this returns — the row it
    resolves against is gone — so there is nothing left to hand back but a
    204.
    """
    user_id = user.id
    phone = user.phone

    child_ids = list((await db.scalars(select(ChildProfile.id).where(_actionable_by(user_id)))).all())
    media_keys, retained = await _detach(db, child_ids, frozenset({user_id}))

    await db.delete(user)
    await db.commit()

    await otp.purge(phone)
    _remove_media(media_keys)

    log.info(
        "account deleted user=%s children=%d media=%d crisis_retained=%d",
        user_id, len(child_ids), len(media_keys), retained,
    )
    return DeletionReceipt(
        children=len(child_ids),
        media_objects=len(media_keys),
        crisis_events_retained=retained,
    )


async def delete_children(db: AsyncSession, child_ids: list[UUID]) -> DeletionReceipt:
    """Erase specific child profiles and leave their account standing.

    The 13+ age floor needs this: one account can hold a child who is old
    enough alongside one who is not, and erasing the whole family over the
    second would take the first one's data with it.

    Commits. Same guarantees as `delete_account` for the children named —
    cascade, de-identified crisis trail, stripped group media, bucket objects
    removed after the commit.
    """
    if not child_ids:
        return DeletionReceipt(children=0, media_objects=0, crisis_events_retained=0)

    owners = frozenset(
        uid
        for uid in (
            await db.scalars(
                select(ChildProfile.parent_id).where(ChildProfile.id.in_(child_ids))
            )
        ).all()
        if uid is not None
    )
    media_keys, retained = await _detach(db, child_ids, owners)

    await db.execute(sa_delete(ChildProfile).where(ChildProfile.id.in_(child_ids)))
    await db.commit()

    _remove_media(media_keys)

    log.info(
        "children purged count=%d media=%d crisis_retained=%d",
        len(child_ids), len(media_keys), retained,
    )
    return DeletionReceipt(
        children=len(child_ids),
        media_objects=len(media_keys),
        crisis_events_retained=retained,
    )


__all__ = ["DeletionReceipt", "delete_account", "delete_children"]
