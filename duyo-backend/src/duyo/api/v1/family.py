"""Family linking — parent invites a child's own phone to a second account.

Replaces the old "how old are you" onboarding step for a parent: instead of
answering for the child, the parent enters the child's own phone number here.
That triggers an ordinary login OTP to the child's phone (same SMS a login
would send — Eskiz only delivers pre-approved templates, so this is not a
custom "you've been invited" message). The moment that phone number completes
its own OTP verify (see api/v1/auth.verify_otp), the invite is claimed and
create_child attaches the new account to this parent instead of starting an
unlinked family.
"""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from duyo.api.deps import get_current_user, get_db
from duyo.api.v1.auth import send_otp
from duyo.models.child import ChildProfile
from duyo.models.family_invite import FamilyInvite, default_expiry
from duyo.models.user import User
from duyo.schemas.auth import OTPRequest
from duyo.schemas.family import FamilyInviteCreate, FamilyInviteRead

router = APIRouter(prefix="/family", tags=["family"])


@router.post("/invite", response_model=FamilyInviteRead, status_code=status.HTTP_201_CREATED)
async def create_invite(
    payload: FamilyInviteCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FamilyInvite:
    """Record the child's phone and text them a login code.

    Re-submitting (a retry, a typo fix) updates this parent's one pending
    invite instead of piling up duplicates — the same fix create_child
    already needed for the identical double-tap problem. Re-submitting also
    restarts the clock and clears an earlier refusal, because a parent who
    sends again is making a new offer.

    Nothing is linked here. The invitee decides — see accept_invite.
    """
    if payload.child_phone == current_user.phone:
        # Self-invite would make an account its own child: create_child would
        # then read the claim and set parent_id == child_user_id, and the
        # unique constraint on child_user_id would cap the account at one
        # profile forever. Refuse it instead of half-supporting it.
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "O'z raqamingizni farzand sifatida qo'sha olmaysiz",
        )

    invite = await db.scalar(
        select(FamilyInvite).where(
            FamilyInvite.parent_id == current_user.id,
            FamilyInvite.claimed.is_(False),
        )
    )
    if invite is None:
        invite = FamilyInvite(
            parent_id=current_user.id,
            child_name=payload.child_name,
            child_phone=payload.child_phone,
        )
        db.add(invite)
    else:
        invite.child_name = payload.child_name
        invite.child_phone = payload.child_phone
        invite.declined_at = None
        invite.expires_at = default_expiry()
    await db.flush()

    # Raises 429 itself on rate limit; sends via the real Eskiz template.
    await send_otp(OTPRequest(phone=payload.child_phone))

    await db.commit()
    await db.refresh(invite)
    return invite


@router.get("/invite", response_model=FamilyInviteRead | None)
async def get_invite(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FamilyInvite | None:
    """The most recent invite this parent sent, or null if they've never sent one.

    Polled by the "waiting for your child" screen to learn the moment the
    child's phone completes its own login.
    """
    invite: FamilyInvite | None = await db.scalar(
        select(FamilyInvite)
        .where(FamilyInvite.parent_id == current_user.id)
        .order_by(FamilyInvite.created_at.desc())
    )
    return invite


async def _open_invite_for(user: User, db: AsyncSession) -> FamilyInvite:
    """The offer awaiting THIS account's decision, or 404.

    Scoped by the caller's own phone — an invite can only ever be acted on by
    the person who holds the number it was sent to. Newest first, matching
    auth.verify_otp: the newest offer is the one whose code was just used.
    """
    invite = await db.scalar(
        select(FamilyInvite)
        .where(
            FamilyInvite.child_phone == user.phone,
            FamilyInvite.claimed.is_(False),
            FamilyInvite.declined_at.is_(None),
            FamilyInvite.expires_at > datetime.now(UTC),
        )
        .order_by(FamilyInvite.created_at.desc())
    )
    if invite is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No pending invite")
    return invite


@router.post("/invite/accept", response_model=FamilyInviteRead)
async def accept_invite(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FamilyInvite:
    """Consent to being added to the inviting parent's family.

    This is the ONLY thing that turns an offer into a link — see
    models/family_invite.py. It is deliberately a separate, authenticated act
    by the invited account rather than a side effect of signing in.
    """
    invite = await _open_invite_for(current_user, db)

    # An account that already has a profile never reaches create_child — the
    # app routes it straight to the tabs — so without this the accept would
    # be a no-op and the inviting parent would poll forever on a screen that
    # cannot tell "not yet" from "never". Link the existing profile here.
    existing = await db.scalar(
        select(ChildProfile).where(
            (ChildProfile.child_user_id == current_user.id)
            | (ChildProfile.parent_id == current_user.id)
        )
    )
    if existing is not None:
        if existing.child_user_id is not None and existing.child_user_id != current_user.id:
            raise HTTPException(
                status.HTTP_409_CONFLICT, "Bu profil boshqa hisobga bog'langan"
            )
        if existing.parent_id != current_user.id and existing.child_user_id == current_user.id:
            # Already someone else's linked child. One family at a time.
            raise HTTPException(
                status.HTTP_409_CONFLICT, "Siz allaqachon oilaga bog'langansiz"
            )
        existing.parent_id = invite.parent_id
        existing.child_user_id = current_user.id

    invite.claimed = True
    invite.claimed_by_user_id = current_user.id
    invite.claimed_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(invite)
    return invite


@router.post("/invite/decline", response_model=FamilyInviteRead)
async def decline_invite(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FamilyInvite:
    """Refuse the offer. A declined invite is never offered again.

    Recorded rather than deleted so a parent polling GET /family/invite can
    see that the answer was "no", instead of waiting forever on a screen that
    cannot distinguish refusal from silence.
    """
    invite = await _open_invite_for(current_user, db)
    invite.declined_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(invite)
    return invite
