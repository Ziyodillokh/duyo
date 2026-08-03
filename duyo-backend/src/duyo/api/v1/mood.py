"""Daily mood check-in.

Two routes only: read today's, set today's. Upsert rather than insert, so a
child changing their mind during the day corrects the reading instead of
creating a second one.
"""

from datetime import UTC, date, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from duyo.api.deps import get_current_user, get_db
from duyo.api.v1.chat import _get_owned_child
from duyo.models.mood import MoodEntry, MoodValue
from duyo.models.user import User

router = APIRouter(tags=["mood"])


class MoodSet(BaseModel):
    mood: MoodValue


class MoodRead(BaseModel):
    mood: MoodValue | None
    entry_date: date


def _today() -> date:
    return datetime.now(UTC).date()


@router.get("/children/{child_id}/mood/today", response_model=MoodRead)
async def get_today_mood(
    child_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MoodRead:
    child = await _get_owned_child(child_id, current_user, db)
    today = _today()
    entry = await db.scalar(
        select(MoodEntry).where(
            MoodEntry.child_id == child.id, MoodEntry.entry_date == today
        )
    )
    return MoodRead(mood=entry.mood if entry else None, entry_date=today)


@router.put(
    "/children/{child_id}/mood/today",
    response_model=MoodRead,
    status_code=status.HTTP_200_OK,
)
async def set_today_mood(
    child_id: UUID,
    payload: MoodSet,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MoodRead:
    child = await _get_owned_child(child_id, current_user, db)
    today = _today()
    entry = await db.scalar(
        select(MoodEntry).where(
            MoodEntry.child_id == child.id, MoodEntry.entry_date == today
        )
    )
    if entry is None:
        entry = MoodEntry(child_id=child.id, entry_date=today, mood=payload.mood)
        db.add(entry)
    else:
        entry.mood = payload.mood
    await db.flush()
    return MoodRead(mood=entry.mood, entry_date=today)
