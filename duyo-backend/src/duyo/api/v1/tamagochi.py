"""Tamagochi endpoints — DUYO well-being state (Concept §4).

Two routes, both parent-scoped (another family's child → 404):
  GET  /tamagochi/{child_id}          read state (lazy-decayed)
  POST /tamagochi/{child_id}/interact restore a metric via a care interaction

Decay is applied lazily on every read from `last_decay_at`, so no cron is
needed. DUYO never dies — metrics clamp at 0 (Concept §4.2).
"""

from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from duyo.api.deps import get_current_user, get_db
from duyo.gamification.tamagochi import Metrics, decay, restore
from duyo.models.child import ChildProfile
from duyo.models.tamagochi import TamagochiState
from duyo.models.user import User
from duyo.schemas.tamagochi import TamagochiInteract, TamagochiRead

router = APIRouter(prefix="/tamagochi", tags=["tamagochi"])

# Interaction kind → which metric it restores (Concept §4.1).
_KIND_METRIC: dict[str, str] = {
    "check_in": "energy",
    "lesson": "learning",
    "play": "joy",
    "activity": "health",
}


async def _owned_child(child_id: UUID, user: User, db: AsyncSession) -> ChildProfile:
    child = await db.scalar(
        select(ChildProfile).where(
            ChildProfile.id == child_id,
            (ChildProfile.parent_id == user.id) | (ChildProfile.child_user_id == user.id),
        )
    )
    if child is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Child not found")
    return child


def _metrics(state: TamagochiState) -> Metrics:
    return Metrics(
        energy=state.energy, joy=state.joy,
        learning=state.learning, health=state.health,
    )


def _apply(state: TamagochiState, m: Metrics) -> None:
    state.energy, state.joy = m.energy, m.joy
    state.learning, state.health = m.learning, m.health


async def _get_or_create_state(child_id: UUID, db: AsyncSession) -> TamagochiState:
    state = await db.scalar(
        select(TamagochiState).where(TamagochiState.child_id == child_id)
    )
    if state is None:
        # Set metrics explicitly (not relying on flush-time column defaults) so
        # a freshly-created state is fully populated in-memory before decay runs.
        state = TamagochiState(
            child_id=child_id,
            energy=100, joy=100, learning=100, health=100,
            last_decay_at=datetime.now(UTC),
        )
        db.add(state)
        await db.flush()
    return state


def _decay_in_place(state: TamagochiState, now: datetime) -> None:
    """Apply elapsed-time decay and advance last_decay_at to `now`."""
    last = state.last_decay_at
    if last.tzinfo is None:
        last = last.replace(tzinfo=UTC)
    elapsed = (now - last).total_seconds()
    if elapsed <= 0:
        return
    _apply(state, decay(_metrics(state), elapsed))
    state.last_decay_at = now


@router.get("/{child_id}", response_model=TamagochiRead)
async def get_state(
    child_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TamagochiState:
    await _owned_child(child_id, current_user, db)
    state = await _get_or_create_state(child_id, db)
    _decay_in_place(state, datetime.now(UTC))
    await db.flush()
    return state


@router.post("/{child_id}/interact", response_model=TamagochiRead)
async def interact(
    child_id: UUID,
    payload: TamagochiInteract,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TamagochiState:
    """Restore a metric. Decay is settled first, then the boost is applied."""
    await _owned_child(child_id, current_user, db)
    state = await _get_or_create_state(child_id, db)
    _decay_in_place(state, datetime.now(UTC))
    metric = _KIND_METRIC[payload.kind]
    _apply(state, restore(_metrics(state), {metric: payload.amount}))
    await db.flush()
    return state
