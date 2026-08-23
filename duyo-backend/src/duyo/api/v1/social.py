"""Goal-mates: find peers with the same goal, connect, and talk.

Authorization has two layers, because ownership alone is not enough here:

- `_get_owned_child` answers "is this MY child" (the caller's own).
- `_get_edge` answers "may my child talk to that one" — membership in an
  accepted friendship. A peer is by definition NOT owned by the caller, so
  every peer-touching route needs both.

Everything 404s rather than 403s on failure, so existence never leaks.
"""

import logging
from datetime import UTC, datetime
from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from fastapi.responses import StreamingResponse
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from duyo.api.deps import get_current_user, get_db
from duyo.api.v1.chat import _get_owned_child
from duyo.core import storage

# Aliased: this module already defines a ROUTE called `get_settings` (the
# child's social settings), which shadows the app-config one further down the
# file.
from duyo.core.config import get_settings as get_app_settings
from duyo.crisis.detector import KeywordCrisisDetector
from duyo.crisis.router import get_detector
from duyo.models.child import ChildProfile
from duyo.models.social import (
    ChildSocialSettings,
    Friendship,
    FriendshipStatus,
    GroupMessage,
    PeerMessage,
    PeerModerationState,
    PeerReport,
)
from duyo.models.user import User
from duyo.schemas.social import (
    FriendRequestCreate,
    FriendshipRead,
    GoalMateRead,
    GroupMessageCreate,
    GroupMessageRead,
    GroupRead,
    HandleSuggestions,
    PeerCard,
    PeerMessageCreate,
    PeerMessageRead,
    PeerReportCreate,
    SocialSettingsRead,
    SocialSettingsUpdate,
)
from duyo.services import groups as group_svc
from duyo.services.media_notes import transcribe
from duyo.services.social import (
    HandleError,
    MessageVerdict,
    canonical_pair,
    find_friendship,
    find_goal_mates,
    generate_handle,
    get_or_create_settings,
    screen_peer_message,
    suggest_handles,
    validate_handle,
)

log = logging.getLogger(__name__)

router = APIRouter(prefix="/social", tags=["social"])

#: A child does not need dozens of open connections, and a cap is the single
#: highest-yield anti-abuse control: mass outreach is how a bad actor finds the
#: vulnerable minority, and a cap makes that economically useless.
_MAX_CONNECTIONS = 10
_MAX_PENDING_OUT = 5

#: Messages returned per request. The window follows the END of the thread
#: (see list_messages), so this bounds the payload without ever hiding the
#: part of the conversation the children are actually having.
_MESSAGE_PAGE = 100


#: What the SENDER is told when their message is not delivered.
#:
#: Every refusal used to say "you may not exchange personal information",
#: which was true when contact details were the only thing being blocked. Now
#: that peer-harm screening also runs, that text reaches a child who asked to
#: meet up and a child who threatened someone — and a filter whose stated
#: reason does not match what the child did is one they learn to treat as
#: random noise and route around.
#:
#: Two rules shape these strings:
#:
#: 1. Where the rule is a POLICY, state it plainly. "Do not arrange to meet in
#:    person" is a rule a child can follow, and saying it is fairer than a
#:    vague refusal that reads as an accusation.
#: 2. Where the block is a JUDGEMENT about intent (grooming, sexual content),
#:    say nothing specific. Naming the signal teaches whoever tripped it what
#:    to avoid next time, and the person most motivated to learn that is the
#:    one this exists to stop.
#:
#: The recipient is told nothing in any case.
_REFUSAL_DEFAULT = (
    "Bu xabar yuborilmadi. Xohlasang, DUYO bilan gaplashamiz."
)

_REFUSALS: dict[str, str] = {
    "contact_info": (
        "Bu xabar yuborilmadi. Xavfsizlik uchun telefon raqami, manzil yoki "
        "boshqa ilovadagi profilni almashish mumkin emas."
    ),
    "peer_harm_meeting": (
        "Bu xabar yuborilmadi. DUYO orqali tanishgan bilan haqiqiy hayotda "
        "uchrashishga kelishish mumkin emas — bu qoida hamma uchun bir xil."
    ),
    "peer_harm_threat": (
        "Bu xabar yuborilmadi. Boshqa bolaga tahdid qilish mumkin emas. "
        "Agar kimdir seni xafa qilayotgan bo'lsa, DUYO bilan gaplash."
    ),
    "peer_harm_degradation": (
        "Bu xabar yuborilmadi. Bunday so'zlar boshqa bolani jiddiy "
        "ranjitadi. Xohlasang, nima bo'lganini DUYO bilan gaplashamiz."
    ),
    "too_long": "Xabar juda uzun. Qisqaroq yozib ko'r.",
    "empty": "Xabar bo'sh.",
}


def _refusal_text(reason: str | None) -> str:
    """Explain a refusal to the sender without teaching evasion.

    `peer_harm_sexual` and `peer_harm_grooming` are absent from the table on
    purpose — they fall through to the neutral default. Crisis reasons fall
    through too: the author may be the one in trouble, and the right response
    is an offer to talk, not an explanation of what was matched.
    """
    return _REFUSALS.get(reason or "", _REFUSAL_DEFAULT)


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
    for peer, peer_settings, entry in mates:
        # The shared goal is named from the CATALOGUE TITLE, never from either
        # child's free-typed title. It used to be derived from the key, so a
        # child read "Umumiy maqsad: Book otkan kunlar" where a human had
        # already written "Abdulla Qodiriy — O'tkan Kunlar".
        out.append(
            GoalMateRead(
                peer=PeerCard(
                    child_id=peer.id,
                    display_name=peer_settings.display_name,
                    age_segment=peer.age_segment,
                ),
                match_key=entry.match_key,
                shared_goal=entry.title,
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
    #
    # Computed ONCE and reused for the match_key below. It used to run twice —
    # two multi-join queries plus the edge scan — and the second call could
    # legitimately return a different set than the first, so the key recorded
    # on the edge did not have to be the one the check passed on.
    mates = await find_goal_mates(db, child, limit=50)
    shared = next(
        (entry for peer, _s, entry in mates if peer.id == payload.peer_child_id),
        None,
    )
    if shared is None:
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
    edge = Friendship(
        child_low_id=low,
        child_high_id=high,
        requested_by_id=child.id,
        status=FriendshipStatus.PENDING,
        match_key=shared.match_key,
    )
    db.add(edge)
    try:
        await db.flush()
    except IntegrityError:
        # Both children tapped "Do'stlashish" on each other at the same time.
        # find_goal_mates cleared both — neither edge existed yet — and the
        # canonical pair means both INSERTs target the same row, so the loser
        # hit uq_friendship_pair and the child saw a 500. Two children liking
        # each other simultaneously is the happy path, not an error: adopt the
        # row that won.
        await db.rollback()
        existing_edge = await find_friendship(db, child.id, payload.peer_child_id)
        if existing_edge is None:
            raise
        edge = existing_edge
    return FriendshipRead(
        id=edge.id,
        peer=await _peer_card(db, payload.peer_child_id),
        status=edge.status,
        # Not hardcoded False: on the race path above the surviving row may be
        # the PEER's request, which this child now needs to accept.
        incoming=edge.requested_by_id != child.id,
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
    """Paged on `seq`, the only orderable key — UUIDs are not and created_at ties.

    Returns the NEWEST page, not the oldest. Ordering ascending and taking the
    first 100 meant a thread froze permanently once it passed 100 delivered
    messages: the client polls with the default after_seq=0, so it kept
    re-fetching the same first 100 and no message sent after that was ever
    visible to anyone. Descending-then-reversed keeps the same ascending
    result shape while making the window follow the conversation.
    """
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
            .order_by(PeerMessage.seq.desc())
            .limit(_MESSAGE_PAGE)
        )
    ).scalars().all()
    rows = list(reversed(rows))

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
        # COMMIT before raising. get_db rolls back on any exception, and
        # HTTPException is one — so every blocked message was discarded and
        # moderation_state='blocked' could never appear in the table at all.
        # The row IS the safety record: what a child tried to send, and why it
        # was stopped, is exactly what a reviewer needs to see.
        await db.commit()
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, _refusal_text(verdict.reason)
        )

    return PeerMessageRead(
        id=message.id,
        seq=message.seq,
        body=message.body,
        mine=True,
        created_at=message.created_at,
    )


# ---------------------------------------------------------------------------
# Goal groups — the rooms behind the Maqsaddoshlar circles.
#
# Membership is derived, never stored (services/groups.py explains why), so
# there is nothing here to join or leave: the goal IS the membership. Every
# route re-checks it rather than trusting a key the client sent.
# ---------------------------------------------------------------------------


@router.get("/{child_id}/groups", response_model=list[GroupRead])
async def list_groups(
    child_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[GroupRead]:
    """Every room for this child's age band, with the ones they are in flagged.

    Rooms they are NOT in are listed too — a child should be able to see that
    a room exists and what it would take to be in it, rather than have the
    circle silently do nothing.
    """
    child = await _get_owned_child(child_id, current_user, db)
    mine = {c.key for c in await group_svc.categories_for_child(db, child)}

    out: list[GroupRead] = []
    for category in group_svc.CATEGORIES:
        count = await group_svc.member_count(db, category, child.age_segment)
        if count == 0 and category.key not in mine:
            # An empty room nobody is in is noise, not a door.
            continue
        out.append(
            GroupRead(
                key=group_svc.group_key(category.key, child.age_segment),
                category=category.key,
                label=category.label,
                members=count,
                joined=category.key in mine,
            )
        )
    return out


@router.get("/{child_id}/groups/{key}/members", response_model=list[PeerCard])
async def list_group_members(
    child_id: UUID,
    key: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[PeerCard]:
    """The roster, visible only to someone in the room."""
    child = await _get_owned_child(child_id, current_user, db)
    category = await group_svc.is_member(db, child, key)
    if category is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Bu guruh a'zosi emassiz")

    ids = await group_svc.member_ids(db, category, child.age_segment)
    return [await _peer_card(db, pid) for pid in ids if pid != child.id]


def _note_media_url(m: GroupMessage, viewer_id: UUID) -> str:
    """The AUTHENTICATED URL for a note's clip.

    Deliberately NOT `storage.media_url()`. That points at
    `GET /v1/content/media/{key}`, which is public by design and documents
    itself as such — fine for a published book cover, wrong for a recording of
    a child's voice or face. A key is unguessable, but an unguessable URL is
    not access control: it leaks through logs, referrers and shared links, and
    that route even sends `Cache-Control: public`.

    So a note is served by the route below instead, which re-checks the same
    membership as reading the room.
    """
    base = get_app_settings().public_base_url.rstrip("/")
    return f"{base}/v1/social/{viewer_id}/groups/{m.group_key}/notes/{m.id}/media"


def _group_message_read(m: GroupMessage, viewer_id: UUID) -> GroupMessageRead:
    """One row → one wire object.

    The media KEY is stored and the URL is built here, so the bucket can move
    without rewriting rows, and only this one place knows how a key becomes a
    URL.
    """
    return GroupMessageRead(
        id=m.id,
        seq=m.seq,
        body=m.body,
        sender_name=m.sender_name,
        mine=m.sender_child_id == viewer_id,
        created_at=m.created_at,
        media_url=_note_media_url(m, viewer_id) if m.media_key else None,
        media_kind=m.media_kind,
        media_duration_ms=m.media_duration_ms,
    )


@router.get("/{child_id}/groups/{key}/messages", response_model=list[GroupMessageRead])
async def list_group_messages(
    child_id: UUID,
    key: str,
    after_seq: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[GroupMessageRead]:
    """Newest page first, then reversed — see list_messages for why."""
    child = await _get_owned_child(child_id, current_user, db)
    if await group_svc.is_member(db, child, key) is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Bu guruh a'zosi emassiz")

    rows = (
        await db.execute(
            select(GroupMessage)
            .where(
                GroupMessage.group_key == key,
                GroupMessage.seq > after_seq,
                GroupMessage.moderation_state == PeerModerationState.DELIVERED,
            )
            .order_by(GroupMessage.seq.desc())
            .limit(100)
        )
    ).scalars().all()

    return [_group_message_read(m, child.id) for m in reversed(rows)]


@router.post(
    "/{child_id}/groups/{key}/messages",
    response_model=GroupMessageRead,
    status_code=status.HTTP_201_CREATED,
)
async def send_group_message(
    child_id: UUID,
    key: str,
    payload: GroupMessageCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    detector: KeywordCrisisDetector = Depends(get_detector),
) -> GroupMessageRead:
    """Screened before delivery by the SAME pipeline as a one-to-one message.

    A room is a bigger audience than a friendship, never a lighter one, so
    nothing here is relaxed: peer-harm, contact details and Layer-1 crisis all
    still block, and a blocked message is still persisted as the safety
    record.
    """
    child = await _get_owned_child(child_id, current_user, db)
    if await group_svc.is_member(db, child, key) is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Bu guruh a'zosi emassiz")

    settings = await get_or_create_settings(db, child.id)
    verdict = screen_peer_message(payload.body, detector)
    message = GroupMessage(
        group_key=key,
        sender_child_id=child.id,
        # Frozen at send time: renaming must not rewrite what a room saw.
        sender_name=settings.display_name,
        body=payload.body.strip(),
        moderation_state=(
            PeerModerationState.DELIVERED
            if verdict.allowed
            else PeerModerationState.BLOCKED
        ),
        moderation_reason=verdict.reason,
    )
    db.add(message)
    await db.flush()

    if not verdict.allowed:
        # Commit before raising — get_db rolls back on HTTPException, and the
        # blocked row IS the safety record. Same reasoning as send_message.
        await db.commit()
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, _refusal_text(verdict.reason)
        )

    return _group_message_read(message, child.id)


@router.get("/{child_id}/groups/{key}/notes/{message_id}/media")
async def get_group_note_media(
    child_id: UUID,
    key: str,
    message_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Stream a note's clip to someone who is actually in the room.

    The same gate as reading the room's text: own the child, be a member. A
    child who leaves the group — by retiring the goal or turning visibility
    off — stops being able to fetch the audio at the same instant they stop
    seeing the messages, because it is literally the same check.
    """
    child = await _get_owned_child(child_id, current_user, db)
    if await group_svc.is_member(db, child, key) is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Bu guruh a'zosi emassiz")

    message = await db.get(GroupMessage, message_id)
    if (
        message is None
        or message.group_key != key
        or not message.media_key
        # A blocked note is evidence for a moderator, never playable content
        # for the room it was aimed at.
        or message.moderation_state != PeerModerationState.DELIVERED
    ):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Yozuv topilmadi")

    try:
        stream, content_type, size = storage.get_object(message.media_key)
    except storage.S3Error as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Yozuv topilmadi") from exc

    return StreamingResponse(
        stream,
        media_type=content_type or "application/octet-stream",
        headers={
            "Content-Length": str(size),
            # PRIVATE, unlike the public content route: a shared cache must
            # never hold one child's voice where another request can reach it.
            "Cache-Control": "private, max-age=3600",
        },
    )


#: The composer's own caps, enforced again here. A client can be edited; the
#: server is the only place a limit is actually a limit.
_MAX_NOTE_MS = {"audio": 75_000, "video": 45_000}

#: Tighter than storage's generic ceilings on purpose. Those exist for admin
#: content uploads; a seconds-long chat note has no business being 20 MB, and
#: the smaller number is what actually bounds abuse here.
_MAX_NOTE_BYTES = {"audio": 4 * 1024 * 1024, "video": 12 * 1024 * 1024}


@router.post(
    "/{child_id}/groups/{key}/notes",
    response_model=GroupMessageRead,
    status_code=status.HTTP_201_CREATED,
)
async def send_group_note(
    child_id: UUID,
    key: str,
    file: UploadFile = File(...),
    kind: str = Form(...),
    duration_ms: int = Form(default=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    detector: KeywordCrisisDetector = Depends(get_detector),
) -> GroupMessageRead:
    """A voice or video note — TRANSCRIBED FIRST, then screened as text.

    The screen that protects this room reads words. A spoken sentence is not
    safer than a typed one, so the clip is transcribed and the transcript goes
    through exactly the same `screen_peer_message` as a text message: same
    peer-harm, contact-detail and crisis rules, no relaxation for being audio.

    A clip that cannot be transcribed is REFUSED rather than delivered.
    Delivering it would mean sending a room of children something no screen
    has read, which is the precise failure this path exists to prevent.

    There is no general "child uploads a file" endpoint on purpose: media
    enters only here, bound to a room the child is already in, and only after
    passing the screen.
    """
    child = await _get_owned_child(child_id, current_user, db)
    if await group_svc.is_member(db, child, key) is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Bu guruh a'zosi emassiz")

    if kind not in ("audio", "video"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Noma'lum yozuv turi")

    content_type = storage.normalise_type(file.content_type or "")
    allowed = storage.AUDIO_TYPES if kind == "audio" else storage.VIDEO_TYPES
    if content_type not in allowed:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Qo'llab-quvvatlanmaydigan fayl turi: {content_type or 'nomalum'}",
        )

    if duration_ms > _MAX_NOTE_MS[kind]:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Yozuv juda uzun — qisqaroq qilib qayta yozing",
        )

    data = await file.read()
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Bo'sh fayl")
    if len(data) > _MAX_NOTE_BYTES[kind]:
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            "Yozuv juda katta — qisqaroq qilib qayta yozing",
        )

    app = get_app_settings()
    unscreened_reason: str | None = None

    if app.google_api_key:
        transcription = await transcribe(data, content_type)
        if not transcription.ok:
            # Fail closed: nothing has read this clip, so nothing may hear it.
            raise HTTPException(
                status.HTTP_503_SERVICE_UNAVAILABLE,
                "Yozuvni tekshirib bo'lmadi. Birozdan so'ng qayta urinib ko'ring.",
            )
        spoken = transcription.text
    elif app.app_env == "development":
        # A local backend with no GOOGLE_API_KEY cannot transcribe, which means
        # notes could never be sent while developing — and every other Gemini
        # feature is equally dead, so the machine is plainly not serving real
        # children. The note goes through UNSCREENED and says so on the row.
        #
        # Narrow on purpose: only development, and only when there is no key at
        # all. Production without a key still refuses, because "misconfigured"
        # must never become "unmoderated" where real children are.
        log.warning(
            "GOOGLE_API_KEY yo'q — %s guruhiga yozuv TEKSHIRILMASDAN o'tkazildi "
            "(faqat development)",
            key,
        )
        unscreened_reason = "dev_unscreened"
        spoken = ""
    else:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Yozuvni tekshirib bo'lmadi. Birozdan so'ng qayta urinib ko'ring.",
        )

    # An empty body would render as an empty bubble, so a wordless clip gets a
    # caption instead of a transcript.
    body = spoken or ("Video xabar" if kind == "video" else "Ovozli xabar")

    if spoken:  # noqa: SIM108 — a ternary would bury the reasoning below
        verdict = screen_peer_message(spoken, detector)
    else:
        # No speech is NOT the same as no screen. Transcription SUCCEEDED and
        # reported silence, so there are no words to judge — and refusing here
        # would make a wordless wave impossible to send, which
        # `screen_peer_message` would do, since it treats an empty string as an
        # empty message and blocks it.
        #
        # The honest limit of this: a clip whose speech the model fails to pick
        # up also arrives as silence, and passes. Words are the only thing this
        # path can screen, so a clip carrying risk in some other form — a face,
        # a place — is not caught here by anything.
        verdict = MessageVerdict(True, None)

    settings = await get_or_create_settings(db, child.id)
    try:
        media_key = storage.upload(data, content_type)
    except storage.UploadError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY, "Yozuvni saqlab bo'lmadi"
        ) from exc

    message = GroupMessage(
        group_key=key,
        sender_child_id=child.id,
        sender_name=settings.display_name,
        body=body,
        media_key=media_key,
        media_kind=kind,
        media_duration_ms=duration_ms or None,
        moderation_state=(
            PeerModerationState.DELIVERED
            if verdict.allowed
            else PeerModerationState.BLOCKED
        ),
        # On a delivered row this carries `dev_unscreened` when the local
        # backend had no key — so the row never claims a screen that never ran.
        moderation_reason=verdict.reason or unscreened_reason,
    )
    db.add(message)
    await db.flush()

    if not verdict.allowed:
        # Committed before raising for the same reason as the text path: the
        # blocked row IS the safety record, and here it keeps the clip too, so
        # a moderator can hear what the transcript only approximates.
        await db.commit()
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, _refusal_text(verdict.reason)
        )

    return _group_message_read(message, child.id)
