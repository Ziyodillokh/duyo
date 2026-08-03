"""Goal-mates: find peers with the same goal, connect, and talk.

Authorization has two layers, because ownership alone is not enough here:

- `_get_owned_child` answers "is this MY child" (the caller's own).
- `_get_edge` answers "may my child talk to that one" — membership in an
  accepted friendship. A peer is by definition NOT owned by the caller, so
  every peer-touching route needs both.

Everything 404s rather than 403s on failure, so existence never leaks.
"""

from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from duyo.api.deps import get_current_user, get_db
from duyo.api.v1.chat import _get_owned_child
from duyo.crisis.detector import KeywordCrisisDetector
from duyo.crisis.router import get_detector
from duyo.models.child import ChildProfile
from duyo.models.social import (
    ChildSocialSettings,
    Friendship,
    FriendshipStatus,
    PeerMessage,
    PeerModerationState,
    PeerReport,
)
from duyo.models.user import User
from duyo.schemas.social import (
    FriendRequestCreate,
    FriendshipRead,
    GoalMateRead,
    HandleSuggestions,
    PeerCard,
    PeerMessageCreate,
    PeerMessageRead,
    PeerReportCreate,
    SocialSettingsRead,
    SocialSettingsUpdate,
)
from duyo.services.social import (
    HandleError,
    canonical_pair,
    find_goal_mates,
    generate_handle,
    get_or_create_settings,
    screen_peer_message,
    suggest_handles,
    validate_handle,
)

router = APIRouter(prefix="/social", tags=["social"])

#: A child does not need dozens of open connections, and a cap is the single
#: highest-yield anti-abuse control: mass outreach is how a bad actor finds the
#: vulnerable minority, and a cap makes that economically useless.
_MAX_CONNECTIONS = 10
_MAX_PENDING_OUT = 5


async def _peer_card(session: AsyncSession, child_id: UUID) -> PeerCard:
    row = await session.execute(
        select(ChildProfile, ChildSocialSettings)
        .join(ChildSocialSettings, ChildSocialSettings.child_id == ChildProfile.id)
        .where(ChildProfile.id == child_id)
    )
    found = row.first()
    if found is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Peer not found")
    peer, settings = found
    return PeerCard(
        child_id=peer.id,
        display_name=settings.display_name,
        age_segment=peer.age_segment,
    )


async def _get_edge(
    child: ChildProfile,
    friendship_id: UUID,
    db: AsyncSession,
    *,
    require: FriendshipStatus | None = FriendshipStatus.ACCEPTED,
) -> Friendship:
    edge = await db.scalar(
        select(Friendship).where(
            Friendship.id == friendship_id,
            or_(
                Friendship.child_low_id == child.id,
                Friendship.child_high_id == child.id,
            ),
        )
    )
    if edge is None or (require is not None and edge.status != require):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Connection not found")
    return edge


# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------


@router.get("/{child_id}/settings", response_model=SocialSettingsRead)
async def get_settings(
    child_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SocialSettingsRead:
    child = await _get_owned_child(child_id, current_user, db)
    settings = await get_or_create_settings(db, child.id)
    return SocialSettingsRead(
        display_name=settings.display_name, discoverable=settings.discoverable
    )


@router.put("/{child_id}/settings", response_model=SocialSettingsRead)
async def update_settings(
    child_id: UUID,
    payload: SocialSettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SocialSettingsRead:
    child = await _get_owned_child(child_id, current_user, db)
    settings = await get_or_create_settings(db, child.id)
    if settings.suspended_at is not None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Social access suspended")
    if payload.discoverable is not None:
        settings.discoverable = payload.discoverable
    if payload.display_name is not None:
        try:
            settings.display_name = validate_handle(payload.display_name)
        except HandleError as exc:
            # The message is written for the child, so pass it through as-is.
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)
            ) from exc
    elif payload.regenerate_handle:
        settings.display_name = generate_handle()
    await db.flush()
    return SocialSettingsRead(
        display_name=settings.display_name, discoverable=settings.discoverable
    )


@router.get("/{child_id}/handle-suggestions", response_model=HandleSuggestions)
async def handle_suggestions(
    child_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> HandleSuggestions:
    """Options to pick from. Every word is an animal or a natural feature —
    never a personal name, so no handle carries a gender."""
    await _get_owned_child(child_id, current_user, db)
    return HandleSuggestions(suggestions=suggest_handles())


# ---------------------------------------------------------------------------
# Discovery
# ---------------------------------------------------------------------------


@router.get("/{child_id}/goal-mates", response_model=list[GoalMateRead])
async def goal_mates(
    child_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[GoalMateRead]:
    """Peers sharing an active goal. Requires the child to be discoverable too —
    you cannot browse others while hiding yourself."""
    child = await _get_owned_child(child_id, current_user, db)
    settings = await get_or_create_settings(db, child.id)
    if not settings.discoverable or settings.suspended_at is not None:
        return []

    mates = await find_goal_mates(db, child)
    out: list[GoalMateRead] = []
    for peer, peer_settings, match_key in mates:
        # The shared goal is named from the CATALOGUE key, never from either
        # child's free-typed title.
        out.append(
            GoalMateRead(
                peer=PeerCard(
                    child_id=peer.id,
                    display_name=peer_settings.display_name,
                    age_segment=peer.age_segment,
                ),
                match_key=match_key,
                shared_goal=match_key.replace("-", " ").replace("_", " ").capitalize(),
            )
        )
    return out


# ---------------------------------------------------------------------------
# Connections
# ---------------------------------------------------------------------------


@router.post(
    "/{child_id}/friend-requests",
    response_model=FriendshipRead,
    status_code=status.HTTP_201_CREATED,
)
async def send_friend_request(
    child_id: UUID,
    payload: FriendRequestCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FriendshipRead:
    child = await _get_owned_child(child_id, current_user, db)
    if payload.peer_child_id == child.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cannot befriend yourself")

    settings = await get_or_create_settings(db, child.id)
    if settings.suspended_at is not None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Social access suspended")

    # The peer must be a current, legitimate suggestion — not an id someone
    # typed. This is what makes peer targeting impossible.
    allowed = {p.id for p, _s, _k in await find_goal_mates(db, child, limit=50)}
    if payload.peer_child_id not in allowed:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Peer not available")

    existing = (
        await db.execute(
            select(Friendship).where(
                or_(
                    Friendship.child_low_id == child.id,
                    Friendship.child_high_id == child.id,
                )
            )
        )
    ).scalars().all()
    if sum(1 for e in existing if e.status == FriendshipStatus.ACCEPTED) >= _MAX_CONNECTIONS:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Connection limit reached")
    pending_out = sum(
        1
        for e in existing
        if e.status == FriendshipStatus.PENDING and e.requested_by_id == child.id
    )
    if pending_out >= _MAX_PENDING_OUT:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Too many pending requests")

    low, high = canonical_pair(child.id, payload.peer_child_id)
    match_key = next(
        (k for p, _s, k in await find_goal_mates(db, child, limit=50)
         if p.id == payload.peer_child_id),
        None,
    )
    edge = Friendship(
        child_low_id=low,
        child_high_id=high,
        requested_by_id=child.id,
        status=FriendshipStatus.PENDING,
        match_key=match_key,
    )
    db.add(edge)
    await db.flush()
    return FriendshipRead(
        id=edge.id,
        peer=await _peer_card(db, payload.peer_child_id),
        status=edge.status,
        incoming=False,
        match_key=edge.match_key,
        created_at=edge.created_at,
    )


@router.get("/{child_id}/friends", response_model=list[FriendshipRead])
async def list_friends(
    child_id: UUID,
    edge_status: FriendshipStatus | None = Query(default=None, alias="status"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[FriendshipRead]:
    child = await _get_owned_child(child_id, current_user, db)
    stmt = select(Friendship).where(
        or_(Friendship.child_low_id == child.id, Friendship.child_high_id == child.id)
    )
    if edge_status is not None:
        stmt = stmt.where(Friendship.status == edge_status)
    else:
        # Blocked edges are never listed — blocking is meant to make someone
        # disappear.
        stmt = stmt.where(Friendship.status != FriendshipStatus.BLOCKED)

    edges = (await db.execute(stmt.order_by(Friendship.created_at.desc()))).scalars().all()
    out: list[FriendshipRead] = []
    for edge in edges:
        out.append(
            FriendshipRead(
                id=edge.id,
                peer=await _peer_card(db, edge.other_id(child.id)),
                status=edge.status,
                incoming=edge.requested_by_id != child.id,
                match_key=edge.match_key,
                created_at=edge.created_at,
            )
        )
    return out


@router.post("/{child_id}/friends/{friendship_id}/accept", response_model=FriendshipRead)
async def accept_friend(
    child_id: UUID,
    friendship_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FriendshipRead:
    child = await _get_owned_child(child_id, current_user, db)
    edge = await _get_edge(child, friendship_id, db, require=FriendshipStatus.PENDING)
    # The pair row is shared, so without this the requester could accept their
    # own request.
    if edge.requested_by_id == child.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cannot accept your own request")

    edge.status = FriendshipStatus.ACCEPTED
    edge.accepted_at = datetime.now(UTC)
    await db.flush()
    return FriendshipRead(
        id=edge.id,
        peer=await _peer_card(db, edge.other_id(child.id)),
        status=edge.status,
        incoming=True,
        match_key=edge.match_key,
        created_at=edge.created_at,
    )


@router.post(
    "/{child_id}/friends/{friendship_id}/decline",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def decline_friend(
    child_id: UUID,
    friendship_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    child = await _get_owned_child(child_id, current_user, db)
    edge = await _get_edge(child, friendship_id, db, require=FriendshipStatus.PENDING)
    edge.status = FriendshipStatus.DECLINED
    await db.flush()


@router.post(
    "/{child_id}/friends/{friendship_id}/block",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def block_friend(
    child_id: UUID,
    friendship_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Silent, immediate, bilateral and permanent. No confirmation dialog and
    no explanation is ever required to block someone."""
    child = await _get_owned_child(child_id, current_user, db)
    edge = await _get_edge(child, friendship_id, db, require=None)
    edge.status = FriendshipStatus.BLOCKED
    edge.blocked_by_id = child.id
    await db.flush()


@router.post(
    "/{child_id}/friends/{friendship_id}/report",
    status_code=status.HTTP_202_ACCEPTED,
)
async def report_peer(
    child_id: UUID,
    friendship_id: UUID,
    payload: PeerReportCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """require=None on purpose: blocking someone must not destroy your ability
    to report them."""
    child = await _get_owned_child(child_id, current_user, db)
    edge = await _get_edge(child, friendship_id, db, require=None)
    db.add(
        PeerReport(
            reporter_child_id=child.id,
            reported_child_id=edge.other_id(child.id),
            friendship_id=edge.id,
            reason=payload.reason,
        )
    )
    # A report freezes the channel immediately; a human decides afterwards.
    edge.status = FriendshipStatus.BLOCKED
    edge.blocked_by_id = child.id
    await db.flush()
    return {"status": "received"}


# ---------------------------------------------------------------------------
# Messages
# ---------------------------------------------------------------------------


@router.get(
    "/{child_id}/friends/{friendship_id}/messages",
    response_model=list[PeerMessageRead],
)
async def list_messages(
    child_id: UUID,
    friendship_id: UUID,
    after_seq: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[PeerMessageRead]:
    """Paged on `seq`, the only orderable key — UUIDs are not and created_at ties."""
    child = await _get_owned_child(child_id, current_user, db)
    edge = await _get_edge(child, friendship_id, db)

    rows = (
        await db.execute(
            select(PeerMessage)
            .where(
                PeerMessage.friendship_id == edge.id,
                PeerMessage.seq > after_seq,
                # Blocked and redacted messages never reach any client.
                PeerMessage.moderation_state == PeerModerationState.DELIVERED,
            )
            .order_by(PeerMessage.seq)
            .limit(100)
        )
    ).scalars().all()

    return [
        PeerMessageRead(
            id=m.id,
            seq=m.seq,
            body=m.body,
            mine=m.sender_child_id == child.id,
            created_at=m.created_at,
        )
        for m in rows
    ]


@router.post(
    "/{child_id}/friends/{friendship_id}/messages",
    response_model=PeerMessageRead,
    status_code=status.HTTP_201_CREATED,
)
async def send_message(
    child_id: UUID,
    friendship_id: UUID,
    payload: PeerMessageCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    detector: KeywordCrisisDetector = Depends(get_detector),
) -> PeerMessageRead:
    """Screened BEFORE delivery, and persisted either way.

    A blocked message is stored with moderation_state=blocked so the safety
    queue can see it, and the sender is told plainly but without accusation —
    the child may be the one in trouble. The recipient is told nothing.
    """
    child = await _get_owned_child(child_id, current_user, db)
    edge = await _get_edge(child, friendship_id, db)

    verdict = screen_peer_message(payload.body, detector)
    message = PeerMessage(
        friendship_id=edge.id,
        sender_child_id=child.id,
        body=payload.body.strip(),
        moderation_state=(
            PeerModerationState.DELIVERED if verdict.allowed
            else PeerModerationState.BLOCKED
        ),
        moderation_reason=verdict.reason,
    )
    db.add(message)
    await db.flush()

    if not verdict.allowed:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Bu xabar yuborilmadi. Xavfsizlik uchun shaxsiy ma'lumot "
            "almashish mumkin emas. Xohlasang, DUYO bilan gaplashamiz.",
        )

    return PeerMessageRead(
        id=message.id,
        seq=message.seq,
        body=message.body,
        mine=True,
        created_at=message.created_at,
    )
