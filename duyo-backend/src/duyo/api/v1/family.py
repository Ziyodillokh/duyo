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

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from duyo.api.deps import get_current_user, get_db
from duyo.api.v1.auth import send_otp
from duyo.models.family_invite import FamilyInvite
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
    already needed for the identical double-tap problem.
    """
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
