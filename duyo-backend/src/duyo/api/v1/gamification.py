"""Gamification endpoints — avatar, balls (XP), inventory, streak.

Concept §3 (avatar) and §8 (ball/level/streak/inventory). Every route is
scoped to a child owned by the authenticated parent; another family's child
returns 404 so existence never leaks.
"""

from __future__ import annotations

from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from duyo.api.deps import get_current_user, get_db
from duyo.gamification.levels import level_info
from duyo.gamification.streaks import next_streak
from duyo.models.child import ChildProfile
from duyo.models.gamification import (
    Avatar,
    BallsTransaction,
    InventoryItem,
    Streak,
)
from duyo.models.user import User
from duyo.schemas.gamification import (
    AvatarRead,
    AvatarUpdate,
    BallsAward,
    BallsBalance,
    BallsSpend,
    BallsTransactionRead,
    InventoryItemRead,
    InventoryPurchase,
    StreakRead,
)

router = APIRouter(prefix="/gamification", tags=["gamification"])

_HISTORY_LIMIT = 50


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _owned_child(child_id: UUID, user: User, db: AsyncSession) -> ChildProfile:
    child = await db.scalar(
        select(ChildProfile).where(
            ChildProfile.id == child_id,
            ChildProfile.parent_id == user.id,
        )
    )
    if child is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Child not found")
    return child


async def _balance(child_id: UUID, db: AsyncSession) -> int:
    """Current ball balance = SUM(amount) over the ledger (0 if none)."""
    total = await db.scalar(
        select(func.coalesce(func.sum(BallsTransaction.amount), 0)).where(
            BallsTransaction.child_id == child_id
        )
    )
    return int(total or 0)


async def _get_or_create_avatar(child_id: UUID, db: AsyncSession) -> Avatar:
    avatar = await db.scalar(select(Avatar).where(Avatar.child_id == child_id))
    if avatar is None:
        avatar = Avatar(child_id=child_id)
        db.add(avatar)
        await db.flush()
    return avatar


async def _get_or_create_streak(child_id: UUID, db: AsyncSession) -> Streak:
    streak = await db.scalar(select(Streak).where(Streak.child_id == child_id))
    if streak is None:
        streak = Streak(child_id=child_id)
        db.add(streak)
        await db.flush()
    return streak


# ---------------------------------------------------------------------------
# Avatar
# ---------------------------------------------------------------------------

@router.get("/{child_id}/avatar", response_model=AvatarRead)
async def get_avatar(
    child_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Avatar:
    await _owned_child(child_id, current_user, db)
    return await _get_or_create_avatar(child_id, db)


@router.put("/{child_id}/avatar", response_model=AvatarRead)
async def update_avatar(
    child_id: UUID,
    payload: AvatarUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Avatar:
    await _owned_child(child_id, current_user, db)
    avatar = await _get_or_create_avatar(child_id, db)
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(avatar, field, value)
    await db.flush()
    return avatar


# ---------------------------------------------------------------------------
# Balls (XP)
# ---------------------------------------------------------------------------

def _balance_response(balance: int) -> BallsBalance:
    info = level_info(balance)
    return BallsBalance(
        balance=info.balance,
        level=info.level,
        level_name=info.name,
        next_threshold=info.next_threshold,
        balls_to_next=info.balls_to_next,
    )


@router.get("/{child_id}/balls", response_model=BallsBalance)
async def get_balls(
    child_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BallsBalance:
    await _owned_child(child_id, current_user, db)
    return _balance_response(await _balance(child_id, db))


@router.get("/{child_id}/balls/history", response_model=list[BallsTransactionRead])
async def get_balls_history(
    child_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[BallsTransaction]:
    await _owned_child(child_id, current_user, db)
    result = await db.execute(
        select(BallsTransaction)
        .where(BallsTransaction.child_id == child_id)
        .order_by(BallsTransaction.created_at.desc())
        .limit(_HISTORY_LIMIT)
    )
    return list(result.scalars().all())


@router.post("/{child_id}/balls/award", response_model=BallsBalance)
async def award_balls(
    child_id: UUID,
    payload: BallsAward,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BallsBalance:
    await _owned_child(child_id, current_user, db)
    new_balance = await _balance(child_id, db) + payload.amount
    db.add(BallsTransaction(
        child_id=child_id, amount=payload.amount,
        reason=payload.reason, balance_after=new_balance,
    ))
    await db.flush()
    return _balance_response(new_balance)


@router.post("/{child_id}/balls/spend", response_model=BallsBalance)
async def spend_balls(
    child_id: UUID,
    payload: BallsSpend,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BallsBalance:
    await _owned_child(child_id, current_user, db)
    balance = await _balance(child_id, db)
    if payload.amount > balance:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Insufficient balls: have {balance}, need {payload.amount}",
        )
    new_balance = balance - payload.amount
    db.add(BallsTransaction(
        child_id=child_id, amount=-payload.amount,
        reason=payload.reason, balance_after=new_balance,
    ))
    await db.flush()
    return _balance_response(new_balance)


# ---------------------------------------------------------------------------
# Inventory
# ---------------------------------------------------------------------------

@router.get("/{child_id}/inventory", response_model=list[InventoryItemRead])
async def get_inventory(
    child_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[InventoryItem]:
    await _owned_child(child_id, current_user, db)
    result = await db.execute(
        select(InventoryItem)
        .where(InventoryItem.child_id == child_id)
        .order_by(InventoryItem.created_at)
    )
    return list(result.scalars().all())


@router.post(
    "/{child_id}/inventory/purchase",
    response_model=InventoryItemRead,
    status_code=status.HTTP_201_CREATED,
)
async def purchase_item(
    child_id: UUID,
    payload: InventoryPurchase,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> InventoryItem:
    """Buy an inventory item: deduct balls and record ownership atomically.

    409 if already owned; 400 if the child cannot afford it.
    """
    await _owned_child(child_id, current_user, db)

    existing = await db.scalar(
        select(InventoryItem).where(
            InventoryItem.child_id == child_id,
            InventoryItem.item_key == payload.item_key,
        )
    )
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Item already owned")

    balance = await _balance(child_id, db)
    if payload.cost > balance:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Insufficient balls: have {balance}, need {payload.cost}",
        )

    if payload.cost > 0:
        db.add(BallsTransaction(
            child_id=child_id, amount=-payload.cost,
            reason=f"buy:{payload.item_key}", balance_after=balance - payload.cost,
        ))
    item = InventoryItem(
        child_id=child_id, item_key=payload.item_key, category=payload.category,
    )
    db.add(item)
    await db.flush()
    return item


# ---------------------------------------------------------------------------
# Streak
# ---------------------------------------------------------------------------

@router.get("/{child_id}/streak", response_model=StreakRead)
async def get_streak(
    child_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Streak:
    await _owned_child(child_id, current_user, db)
    return await _get_or_create_streak(child_id, db)


@router.post("/{child_id}/streak/checkin", response_model=StreakRead)
async def streak_checkin(
    child_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Streak:
    """Record a daily check-in. Same day = no-op; consecutive day = +1;
    a gap resets to 1. Concept §8.4 — broken streak carries no guilt."""
    await _owned_child(child_id, current_user, db)
    streak = await _get_or_create_streak(child_id, db)

    advance = next_streak(streak.current_streak, streak.last_active_date, date.today())
    if not advance.changed:
        return streak  # already checked in today

    streak.current_streak = advance.current_streak
    streak.last_active_date = date.today()
    streak.longest_streak = max(streak.longest_streak, streak.current_streak)
    await db.flush()
    return streak
