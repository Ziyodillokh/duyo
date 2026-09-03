"""Auth endpoints — SMS OTP login + JWT refresh."""

import logging
from datetime import UTC, datetime
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from duyo.api.deps import get_current_user, get_db
from duyo.core.config import get_settings
from duyo.core.security import create_token, decode_token, is_current
from duyo.models.user import User
from duyo.schemas.auth import (
    OTPRequest,
    OTPVerify,
    RefreshRequest,
    TokenResponse,
)
from duyo.services import rate_limit, token_revocation
from duyo.services.otp import OTPInvalid, OTPRateLimited, demo_code, issue, verify
from duyo.services.sms import SMSNumberRejected, get_sms_provider, otp_message

log = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])


def _build_token_response(user: User) -> TokenResponse:
    settings = get_settings()
    subject = str(user.id)
    return TokenResponse(
        access_token=create_token(subject, "access", token_version=user.token_version),
        refresh_token=create_token(subject, "refresh", token_version=user.token_version),
        expires_in=settings.jwt_access_token_expire_minutes * 60,
    )


@router.post("/otp/send", status_code=status.HTTP_202_ACCEPTED)
async def send_otp(payload: OTPRequest, request: Request) -> dict[str, str]:
    """Issue a new OTP and send it via SMS (or log in dev)."""
    # Per SOURCE, before the per-phone counter in issue(). That counter bounds
    # how often ONE number can be messaged; it says nothing about how many
    # DIFFERENT numbers one script may walk. Without this, +998 9X XXX XX XX
    # is an SMS-bombing list billed to our Eskiz balance — and a suspended
    # sender ID stops crisis alerts to parents, not just logins.
    settings = get_settings()
    try:
        await rate_limit.hit(
            "otp_send_ip",
            rate_limit.client_ip(request),
            limit=settings.otp_rate_limit_per_ip_per_hour,
            window_seconds=3600,
        )
    except rate_limit.RateLimited as exc:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, detail=str(exc)) from exc

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
    try:
        sent = await sms.send(payload.phone, otp_message(code))
    except SMSNumberRejected:
        # The number itself is unreachable — a typo, not an outage. 422 so
        # the app can say "check the number" rather than "try again later".
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Bu raqamga SMS yuborib bo'lmadi. Raqamni tekshiring.",
        ) from None
    except httpx.HTTPError as exc:
        # Provider unreachable or erroring — that IS "try again later", and
        # it must not fall through as a bare 500 with a stack trace.
        log.warning("otp sms send failed: %s", exc)
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            detail="SMS provider error",
        ) from exc
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
    # Commit here rather than leaning on get_db's teardown: that commit runs
    # after the response is built, so a failure there would hand the app a
    # token for an account that was never stored.
    await db.commit()

    return _build_token_response(user)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    payload: RefreshRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """Exchange a refresh token for a new pair, and retire the one presented.

    Single use, deliberately. The old behaviour minted a new pair and left the
    presented token valid for the rest of its life, so a copied refresh token
    was a session that renewed itself forever and that nobody could see. Now a
    second presentation of the same token can only mean two holders, and the
    account signs out everywhere on the spot.
    """
    try:
        claims = decode_token(payload.refresh_token, expected_type="refresh")
    except ValueError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

    try:
        user_id = UUID(claims["sub"])
    except (KeyError, ValueError) as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Bad subject claim") from exc

    user = await db.scalar(select(User).where(User.id == user_id))
    if user is None or not is_current(claims, user.token_version):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Session ended")

    jti = claims.get("jti")
    if jti:
        if await token_revocation.was_spent(jti):
            user.token_version += 1
            # Commit before raising: get_db's teardown does not run on the
            # exception path, and a revocation that is not written down is not
            # a revocation.
            await db.commit()
            log.warning("refresh token replayed for user=%s — all sessions ended", user.id)
            raise HTTPException(
                status.HTTP_401_UNAUTHORIZED, detail="Refresh token already used"
            )
        # Remember it only for as long as it could still be presented; past its
        # own expiry decode_token rejects it anyway.
        remaining = int(claims.get("exp", 0)) - int(datetime.now(UTC).timestamp())
        await token_revocation.mark_spent(jti, remaining)

    return _build_token_response(user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """End every session on this account, on every device.

    "Log out" was a client-side erase and told the server nothing, so a stolen
    phone or a shared device kept a working token for as long as its refresh
    lasted. This is the server side of it, and the only remediation a family
    had before it was rotating the app secret and signing out the country.
    """
    current_user.token_version += 1
    await db.commit()
