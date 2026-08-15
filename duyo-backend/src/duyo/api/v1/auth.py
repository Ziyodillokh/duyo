"""Auth endpoints — SMS OTP login + JWT refresh."""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from duyo.api.deps import get_db
from duyo.core.config import get_settings
from duyo.core.security import create_token, decode_token
from duyo.models.family_invite import FamilyInvite
from duyo.models.user import User
from duyo.schemas.auth import (
    OTPRequest,
    OTPVerify,
    PendingFamilyInvite,
    RefreshRequest,
    TokenResponse,
)
from duyo.services.otp import OTPInvalid, OTPRateLimited, demo_code, issue, verify
from duyo.services.sms import get_sms_provider, otp_message

router = APIRouter(prefix="/auth", tags=["auth"])


def _build_token_response(
    user_id: str, pending_family_invite: PendingFamilyInvite | None = None
) -> TokenResponse:
    settings = get_settings()
    return TokenResponse(
        access_token=create_token(user_id, "access"),
        refresh_token=create_token(user_id, "refresh"),
        expires_in=settings.jwt_access_token_expire_minutes * 60,
        pending_family_invite=pending_family_invite,
    )


@router.post("/otp/send", status_code=status.HTTP_202_ACCEPTED)
async def send_otp(payload: OTPRequest) -> dict[str, str]:
    """Issue a new OTP and send it via SMS (or log in dev)."""
    try:
        code = await issue(payload.phone)
    except OTPRateLimited as exc:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, detail=str(exc)) from exc

    # Pilot bypass: no SMS exists to send, and the code is the same published
    # one for everybody — so hand it back and let the app show it. Without
    # this the screen tells the tester to check for an SMS that never arrives.
    if demo_code():
        return {"status": "demo", "phone": payload.phone, "demo_code": demo_code()}

    # Body comes from services/sms.py, which holds the Eskiz-approved wording
    # for every message the app sends. Eskiz rejects anything off-template, so
    # rewording it there (or here) stops every login SMS from arriving.
    sms = get_sms_provider()
    sent = await sms.send(payload.phone, otp_message(code))
    if not sent:
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            detail="SMS provider error",
        )
    return {"status": "sent", "phone": payload.phone}


@router.post("/otp/verify", response_model=TokenResponse)
async def verify_otp(
    payload: OTPVerify,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """Verify OTP — creates the User on first successful verify; returns JWT pair."""
    try:
        ok = await verify(payload.phone, payload.code)
    except OTPInvalid as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    if not ok:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Wrong code")

    # Insert-if-absent in one statement. SELECT-then-INSERT loses to itself
    # under the two uvicorn workers production runs: both would insert, the
    # loser would hit uq_users_phone, and the client would be told its code
    # was wrong. ON CONFLICT DO NOTHING makes a concurrent first login a
    # no-op instead of a 500.
    await db.execute(
        pg_insert(User)
        .values(phone=payload.phone, last_login_at=datetime.now(UTC))
        .on_conflict_do_nothing(index_elements=["phone"])
    )
    user = await db.scalar(select(User).where(User.phone == payload.phone))
    if user is None:  # pragma: no cover — only reachable if the row vanished mid-request
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not create account"
        )
    user.last_login_at = datetime.now(UTC)

    # Someone may have invited this phone into their family. Surface that as
    # an OFFER only — accepting it is a separate, deliberate act by this
    # account (POST /v1/family/invite/accept).
    #
    # This used to link right here, which was a hole: `child_phone` is an
    # arbitrary number typed by whoever invited, the invitee's only signal is
    # an ordinary-looking login SMS, and the reward for typing a stranger's
    # number was becoming the recorded parent of their profile — their chat
    # history, their safety reports, and the crisis alerts that should have
    # reached the real parent. Consent is what closes that.
    #
    # Newest-first: create_invite re-sends the OTP each time, and Redis keeps
    # only the latest code per phone, so the newest offer is provably the one
    # whose code was just answered.
    pending = await db.scalar(
        select(FamilyInvite)
        .where(
            FamilyInvite.child_phone == payload.phone,
            FamilyInvite.claimed.is_(False),
            FamilyInvite.declined_at.is_(None),
            FamilyInvite.expires_at > datetime.now(UTC),
        )
        .order_by(FamilyInvite.created_at.desc())
    )
    pending_invite: PendingFamilyInvite | None = None
    if pending is not None:
        inviter_phone = await db.scalar(select(User.phone).where(User.id == pending.parent_id))
        # Never offer a link the invitee cannot judge: the inviter's number is
        # how they tell a parent they know from a stranger who typed theirs.
        if inviter_phone:
            pending_invite = PendingFamilyInvite(
                id=pending.id,
                child_name=pending.child_name,
                from_phone=inviter_phone,
                expires_at=pending.expires_at,
            )

    # Commit here rather than leaning on get_db's teardown: that commit runs
    # after the response is built, so a failure there would hand the app a
    # token for an account that was never stored.
    await db.commit()

    return _build_token_response(str(user.id), pending_family_invite=pending_invite)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(payload: RefreshRequest) -> TokenResponse:
    """Exchange a valid refresh token for a new access+refresh pair."""
    try:
        claims = decode_token(payload.refresh_token, expected_type="refresh")
    except ValueError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    return _build_token_response(claims["sub"])
