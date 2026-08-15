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
    RefreshRequest,
    TokenResponse,
)
from duyo.services.otp import OTPInvalid, OTPRateLimited, demo_code, issue, verify
from duyo.services.sms import get_sms_provider

router = APIRouter(prefix="/auth", tags=["auth"])


def _build_token_response(user_id: str, linked_child_name: str | None = None) -> TokenResponse:
    settings = get_settings()
    return TokenResponse(
        access_token=create_token(user_id, "access"),
        refresh_token=create_token(user_id, "refresh"),
        expires_in=settings.jwt_access_token_expire_minutes * 60,
        linked_child_name=linked_child_name,
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

    # Eskiz only delivers text that matches a template its moderators approved;
    # anything else is rejected at send time. This string is that template
    # verbatim ("DUYO ilovasiga kirish uchun tasdiqlash kodi: %d (5 daqiqa amal
    # qiladi.)") — do not reword it without re-submitting the template, or
    # every login SMS stops arriving.
    sms = get_sms_provider()
    message = f"DUYO ilovasiga kirish uchun tasdiqlash kodi: {code} (5 daqiqa amal qiladi.)"
    sent = await sms.send(payload.phone, message)
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

    # A parent may have invited this exact phone number before it ever logged
    # in. Claim the oldest still-open invite for it now, while we know for
    # certain this phone just proved it's real — create_child reads the claim
    # to attach the new account to that parent instead of starting a fresh,
    # unlinked family.
    linked_child_name: str | None = None
    invite = await db.scalar(
        select(FamilyInvite).where(
            FamilyInvite.child_phone == payload.phone,
            FamilyInvite.claimed.is_(False),
        ).order_by(FamilyInvite.created_at)
    )
    if invite is not None:
        invite.claimed = True
        invite.claimed_by_user_id = user.id
        invite.claimed_at = datetime.now(UTC)
        linked_child_name = invite.child_name

    # Commit here rather than leaning on get_db's teardown: that commit runs
    # after the response is built, so a failure there would hand the app a
    # token for an account that was never stored.
    await db.commit()

    return _build_token_response(str(user.id), linked_child_name=linked_child_name)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(payload: RefreshRequest) -> TokenResponse:
    """Exchange a valid refresh token for a new access+refresh pair."""
    try:
        claims = decode_token(payload.refresh_token, expected_type="refresh")
    except ValueError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    return _build_token_response(claims["sub"])
