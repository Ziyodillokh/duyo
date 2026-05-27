"""Auth endpoints — SMS OTP login + JWT refresh."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from duyo.api.deps import get_db
from duyo.core.config import get_settings
from duyo.core.security import create_token, decode_token
from duyo.models.user import User
from duyo.schemas.auth import (
    OTPRequest,
    OTPVerify,
    RefreshRequest,
    TokenResponse,
)
from duyo.services.otp import OTPInvalid, OTPRateLimited, issue, verify
from duyo.services.sms import get_sms_provider

router = APIRouter(prefix="/auth", tags=["auth"])


def _build_token_response(user_id: str) -> TokenResponse:
    settings = get_settings()
    return TokenResponse(
        access_token=create_token(user_id, "access"),
        refresh_token=create_token(user_id, "refresh"),
        expires_in=settings.jwt_access_token_expire_minutes * 60,
    )


@router.post("/otp/send", status_code=status.HTTP_202_ACCEPTED)
async def send_otp(payload: OTPRequest) -> dict[str, str]:
    """Issue a new OTP and send it via SMS (or log in dev)."""
    try:
        code = await issue(payload.phone)
    except OTPRateLimited as exc:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, detail=str(exc)) from exc

    sms = get_sms_provider()
    message = f"DUYO tasdiqlash kodi: {code}. 5 daqiqa amal qiladi."
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

    user = await db.scalar(select(User).where(User.phone == payload.phone))
    if user is None:
        user = User(phone=payload.phone, last_login_at=datetime.now(timezone.utc))
        db.add(user)
        await db.flush()  # populate user.id
    else:
        user.last_login_at = datetime.now(timezone.utc)

    return _build_token_response(str(user.id))


@router.post("/refresh", response_model=TokenResponse)
async def refresh(payload: RefreshRequest) -> TokenResponse:
    """Exchange a valid refresh token for a new access+refresh pair."""
    try:
        claims = decode_token(payload.refresh_token, expected_type="refresh")
    except ValueError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    return _build_token_response(claims["sub"])
