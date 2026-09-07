"""Deleting what the privacy policy says is deleted.

duyo.uz/privacy.html publishes a retention table, and one row of it was a
promise nothing kept: peer and group messages "12 oy" (twelve months). Nothing
in the codebase had ever deleted one. A published retention period that is not
implemented is not a documentation slip — under Play's User Data policy it is
a false statement about what happens to a child's data, and the children it
concerns are the ones whose old conversations with each other were meant to
stop existing.

Two tables, both message stores between children:

  peer_messages   one-to-one threads
  group_messages  goal rooms

CRISIS EVENTS ARE NOT TOUCHED. They are held for seven years by a separate,
published rule (models/crisis_event.py), and a message cited by one is already
detached from it — `message_id` is SET NULL — so purging here cannot take an
audit trail with it.

Nothing else is on a clock. Conversations with DUYO itself, notes, goals and
memories have no published expiry: they are the child's own record and they
live until the child or the family deletes them (services/account_deletion.py).

Runs from the app itself rather than from cron. A retention rule that depends
on someone remembering to install a crontab is a retention rule that silently
stops running the first time the server is rebuilt — and the promise would be
false again with nothing to show it.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from duyo.core.database import get_session_factory
from duyo.models.social import GroupMessage, PeerMessage

log = logging.getLogger(__name__)

#: The period published in privacy.html's retention table. Changing it here
#: means changing it there, in all three languages.
PEER_MESSAGE_RETENTION_DAYS = 365

#: Once a day is often enough for a yearly cutoff, and it keeps the query off
#: the request path entirely.
_SWEEP_INTERVAL_SECONDS = 24 * 60 * 60

#: A first sweep at boot would land in the middle of the deploy's own traffic
#: spike; a minute of quiet costs nothing against a 365-day window.
_FIRST_SWEEP_DELAY_SECONDS = 60


def cutoff(now: datetime | None = None) -> datetime:
    """The moment before which peer messages are past their published life."""
    return (now or datetime.now(UTC)) - timedelta(days=PEER_MESSAGE_RETENTION_DAYS)


async def purge_expired_peer_messages(db: AsyncSession, *, now: datetime | None = None) -> dict[str, int]:
    """Delete peer and group messages older than the published period.

    Returns the count per table. Commits.
    """
    before = cutoff(now)
    removed: dict[str, int] = {}
    for model in (PeerMessage, GroupMessage):
        result = await db.execute(delete(model).where(model.created_at < before))
        removed[model.__tablename__] = result.rowcount or 0
    await db.commit()
    return removed


async def count_expired(db: AsyncSession, *, now: datetime | None = None) -> dict[str, int]:
    """What a purge WOULD remove — for the script's dry run."""
    before = cutoff(now)
    counts: dict[str, int] = {}
    for model in (PeerMessage, GroupMessage):
        counts[model.__tablename__] = (
            await db.scalar(
                select(func.count()).select_from(model).where(model.created_at < before)
            )
        ) or 0
    return counts


async def run_forever() -> None:
    """Sweep once a day for as long as the app is up.

    Every failure is caught and logged. A retention sweep that takes the
    process down with it would turn a housekeeping job into an outage, and the
    next pass is only a day away.
    """
    await asyncio.sleep(_FIRST_SWEEP_DELAY_SECONDS)
    session_factory = get_session_factory()
    while True:
        try:
            async with session_factory() as db:
                removed = await purge_expired_peer_messages(db)
            if any(removed.values()):
                log.info(
                    "retention sweep removed peer_messages=%d group_messages=%d",
                    removed.get("peer_messages", 0),
                    removed.get("group_messages", 0),
                )
        except asyncio.CancelledError:
            raise
        except Exception:
            log.exception("Retention sweep failed; retrying next cycle")
        await asyncio.sleep(_SWEEP_INTERVAL_SECONDS)


__all__ = [
    "PEER_MESSAGE_RETENTION_DAYS",
    "count_expired",
    "cutoff",
    "purge_expired_peer_messages",
    "run_forever",
]
