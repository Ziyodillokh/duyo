"""Goals API — what a child is working toward, and how far along they are.

Every child-scoped route goes through `_get_owned_child` (api/v1/chat.py), the
single ownership guard in this codebase; a second copy would be a second place
to get it wrong.

The goal-signal route returns COUNTS ONLY and never an identity. It is the
whole social surface for now: a child learns they are not alone in a goal
without anyone being connected to anyone.
"""

from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from duyo.api.deps import get_current_user, get_db
from duyo.api.v1.chat import _get_owned_child
from duyo.models.child import ChildProfile
from duyo.models.goal import (
    ChildGoal,
    ChildGoalEvent,
    GoalCatalog,
    GoalSource,
    GoalStatus,
)
from duyo.models.social import ChildSocialSettings
from duyo.models.user import User
from duyo.schemas.goal import (
    GoalCatalogRead,
    GoalCreate,
    GoalEventRead,
    GoalProgressCreate,
    GoalRead,
    GoalSignalRead,
    GoalUpdate,
)
from duyo.services.goal_matching import resolve_match_key
from duyo.services.social import MAX_AGE_GAP

router = APIRouter(tags=["goals"])

#: Never reveal a goal is shared until enough children share it that the count
#: cannot point at one person.
_SIGNAL_FLOOR = 3


async def _get_owned_goal(
    child: ChildProfile, goal_id: UUID, db: AsyncSession
) -> ChildGoal:
    """404 (never 403) for another child's goal, so existence never leaks."""
    goal = await db.scalar(
        select(ChildGoal).where(
            ChildGoal.id == goal_id, ChildGoal.child_id == child.id
        )
    )
    if goal is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Goal not found")
    return goal


def _recompute_progress(goal: ChildGoal) -> None:
    if goal.total_units and goal.current_unit is not None and goal.total_units > 0:
        pct = (goal.current_unit / goal.total_units) * 100
        goal.progress_pct = round(min(100.0, max(0.0, pct)), 1)


@router.post(
    "/children/{child_id}/goals",
    response_model=GoalRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_goal(
    child_id: UUID,
    payload: GoalCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ChildGoal:
    child = await _get_owned_child(child_id, current_user, db)

    # An unknown match_key would 500 on the FK; drop it and keep the goal —
    # a goal the catalogue does not know is still a perfectly good goal.
    match_key = payload.match_key
    if match_key:
        known = await db.scalar(
            select(GoalCatalog.match_key).where(GoalCatalog.match_key == match_key)
        )
        if known is None:
            match_key = None

    # No key from the picker? Try to recognise the child's own wording.
    #
    # Without this, only a goal chosen from the catalogue chips could ever
    # match anyone: production had three discoverable children each with a
    # Naruto goal, invisible to one another because two of them had typed it
    # instead of tapping it. resolve_match_key can only ever return a key a
    # human already published, so this widens WHO gets matched, never WHAT
    # they are matched over. See services/goal_matching.py.
    if not match_key:
        match_key = await resolve_match_key(db, payload.title, age=child.age)

    if match_key:
        existing = await db.scalar(
            select(ChildGoal).where(
                ChildGoal.child_id == child.id,
                ChildGoal.match_key == match_key,
                ChildGoal.status == GoalStatus.ACTIVE,
            )
        )
        if existing is not None:
            # Idempotent: re-stating a goal is not an error. Also stops an
            # auto-resolved key colliding with the partial unique index on
            # (child_id, match_key) WHERE status='active'.
            return existing

    goal = ChildGoal(
        child_id=child.id,
        kind=payload.kind,
        title=payload.title.strip(),
        match_key=match_key,
        target_ref=payload.target_ref,
        status=GoalStatus.ACTIVE,
        source=GoalSource(payload.source),
        # Anything the child or parent states directly is confirmed on arrival;
        # only extractor guesses wait for a yes.
        confirmed_at=datetime.now(UTC),
        unit_label=payload.unit_label,
        total_units=payload.total_units,
        target_date=payload.target_date,
    )
    db.add(goal)
    await db.flush()
    return goal


@router.get("/children/{child_id}/goals", response_model=list[GoalRead])
async def list_goals(
    child_id: UUID,
    goal_status: GoalStatus | None = Query(default=None, alias="status"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ChildGoal]:
    child = await _get_owned_child(child_id, current_user, db)
    stmt = select(ChildGoal).where(ChildGoal.child_id == child.id)
    if goal_status is not None:
        stmt = stmt.where(ChildGoal.status == goal_status)
    result = await db.execute(stmt.order_by(ChildGoal.created_at.desc()))
    return list(result.scalars().all())


@router.patch("/children/{child_id}/goals/{goal_id}", response_model=GoalRead)
async def update_goal(
    child_id: UUID,
    goal_id: UUID,
    payload: GoalUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ChildGoal:
    child = await _get_owned_child(child_id, current_user, db)
    goal = await _get_owned_goal(child, goal_id, db)

    if payload.title is not None:
        goal.title = payload.title.strip()
    if payload.status is not None:
        goal.status = payload.status
    if payload.unit_label is not None:
        goal.unit_label = payload.unit_label
    if payload.total_units is not None:
        goal.total_units = payload.total_units
    if payload.target_date is not None:
        goal.target_date = payload.target_date
    _recompute_progress(goal)
    await db.flush()
    return goal


@router.post("/children/{child_id}/goals/{goal_id}/confirm", response_model=GoalRead)
async def confirm_goal(
    child_id: UUID,
    goal_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ChildGoal:
    """Accept an extractor guess. Until this runs the goal never reaches a prompt."""
    child = await _get_owned_child(child_id, current_user, db)
    goal = await _get_owned_goal(child, goal_id, db)
    if goal.confirmed_at is None:
        goal.confirmed_at = datetime.now(UTC)
        await db.flush()
    return goal


@router.post(
    "/children/{child_id}/goals/{goal_id}/progress", response_model=GoalRead
)
async def add_progress(
    child_id: UUID,
    goal_id: UUID,
    payload: GoalProgressCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ChildGoal:
    """Record "10-betdaman". Append-only: the event log is never rewritten."""
    child = await _get_owned_child(child_id, current_user, db)
    goal = await _get_owned_goal(child, goal_id, db)

    if (
        not payload.allow_regress
        and goal.current_unit is not None
        and payload.unit_value < goal.current_unit
    ):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Progress would go backwards ({goal.current_unit} → "
            f"{payload.unit_value}). Send allow_regress=true if intended.",
        )

    db.add(
        ChildGoalEvent(
            goal_id=goal.id,
            child_id=child.id,
            unit_value=payload.unit_value,
            note=payload.note,
            source=goal.source,
        )
    )
    goal.current_unit = payload.unit_value
    goal.last_progress_at = datetime.now(UTC)
    _recompute_progress(goal)
    # Reaching the end closes the goal — the child should be congratulated, not
    # left with a 100% bar still marked "active".
    if goal.total_units and payload.unit_value >= goal.total_units:
        goal.status = GoalStatus.COMPLETED
    await db.flush()
    return goal


@router.get(
    "/children/{child_id}/goals/{goal_id}/progress",
    response_model=list[GoalEventRead],
)
async def list_progress(
    child_id: UUID,
    goal_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ChildGoalEvent]:
    child = await _get_owned_child(child_id, current_user, db)
    goal = await _get_owned_goal(child, goal_id, db)
    result = await db.execute(
        select(ChildGoalEvent)
        .where(ChildGoalEvent.goal_id == goal.id)
        .order_by(ChildGoalEvent.created_at.desc())
        .limit(100)
    )
    return list(result.scalars().all())


@router.delete(
    "/children/{child_id}/goals/{goal_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_goal(
    child_id: UUID,
    goal_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    child = await _get_owned_child(child_id, current_user, db)
    goal = await _get_owned_goal(child, goal_id, db)
    await db.delete(goal)
    await db.flush()


@router.get("/goals/catalog", response_model=list[GoalCatalogRead])
async def goal_catalog(
    kind: str | None = None,
    age: int | None = Query(default=None, ge=7, le=16),
    q: str | None = Query(default=None, max_length=80),
    _current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[GoalCatalog]:
    # `matchable` as well as `active`: tapping a chip attaches its key, and an
    # unreviewed key is exactly what the publish gate exists to keep off the
    # social surface. Offering it in the picker routed around that gate.
    stmt = select(GoalCatalog).where(
        GoalCatalog.active.is_(True),
        GoalCatalog.matchable.is_(True),
    )
    if kind:
        stmt = stmt.where(GoalCatalog.kind == kind)
    if age is not None:
        stmt = stmt.where(GoalCatalog.age_min <= age, GoalCatalog.age_max >= age)
    if q:
        stmt = stmt.where(GoalCatalog.title.ilike(f"%{q}%"))
    result = await db.execute(stmt.order_by(GoalCatalog.title).limit(60))
    return list(result.scalars().all())


@router.get(
    "/children/{child_id}/goal-signal", response_model=list[GoalSignalRead]
)
async def goal_signal(
    child_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[GoalSignalRead]:
    """"4 ta bola ham shu kitobni o'qiyapti" — counts only, never identities.

    Counts only children whose goal maps to a catalogue entry a human marked
    `matchable`, and only above `_SIGNAL_FLOOR`, so no count can point at one
    identifiable child.

    Counts EXACTLY the population `find_goal_mates` draws from — same
    discoverability, suspension and age-band filters. It used to count every
    child in the database with the key, so the goals screen could tell a child
    "5 ta bola ham shu maqsadda" directly above a Maqsaddoshlar section
    reading "Hozircha maqsaddosh topilmadi". Both numbers were correct about
    different populations, and the child could only read that as broken.
    """
    child = await _get_owned_child(child_id, current_user, db)

    mine = await db.execute(
        select(ChildGoal.match_key).where(
            ChildGoal.child_id == child.id,
            ChildGoal.status == GoalStatus.ACTIVE,
            # Confirmed only, matching find_goal_mates: a goal DUYO merely
            # guessed from conversation must not start reporting on peers.
            ChildGoal.confirmed_at.is_not(None),
            ChildGoal.match_key.is_not(None),
        )
    )
    keys = [k for k in mine.scalars().all() if k]
    if not keys:
        return []

    rows = await db.execute(
        select(
            ChildGoal.match_key,
            GoalCatalog.title,
            func.count(func.distinct(ChildGoal.child_id)),
        )
        .join(GoalCatalog, GoalCatalog.match_key == ChildGoal.match_key)
        .join(ChildProfile, ChildProfile.id == ChildGoal.child_id)
        .join(
            ChildSocialSettings,
            ChildSocialSettings.child_id == ChildGoal.child_id,
        )
        .where(
            ChildGoal.match_key.in_(keys),
            ChildGoal.child_id != child.id,
            ChildGoal.status == GoalStatus.ACTIVE,
            ChildGoal.confirmed_at.is_not(None),
            GoalCatalog.matchable.is_(True),
            GoalCatalog.active.is_(True),
            ChildSocialSettings.discoverable.is_(True),
            ChildSocialSettings.suspended_at.is_(None),
            ChildProfile.age_segment == child.age_segment,
            ChildProfile.age >= child.age - MAX_AGE_GAP,
            ChildProfile.age <= child.age + MAX_AGE_GAP,
        )
        .group_by(ChildGoal.match_key, GoalCatalog.title)
    )
    return [
        GoalSignalRead(match_key=key, title=title, count=count)
        for key, title, count in rows.all()
        if count >= _SIGNAL_FLOOR
    ]
