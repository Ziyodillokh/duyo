"""Shared FastAPI dependencies."""

from uuid import UUID

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from duyo.core.database import get_db
from duyo.core.security import decode_token
from duyo.models.user import User


async def get_current_user(
    authorization: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Extract and validate access token, return the User row."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")
    token = authorization[7:]
    try:
        claims = decode_token(token, expected_type="access")
    except ValueError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

    try:
        user_id = UUID(claims["sub"])
    except (KeyError, ValueError) as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Bad subject claim") from exc

    user = await db.scalar(select(User).where(User.id == user_id))
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="User no longer exists")
    return user


__all__ = ["get_current_user", "get_db"]
