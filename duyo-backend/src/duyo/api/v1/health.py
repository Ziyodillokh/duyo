"""Health endpoints — used by k8s/docker healthchecks and Nginx upstream probe."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from duyo.api.deps import get_db
from duyo.services.otp import get_redis

router = APIRouter(prefix="/health", tags=["health"])


@router.get("")
async def liveness() -> dict[str, str]:
    """Liveness — process is up. No external dependencies checked."""
    return {"status": "ok"}


@router.get("/db")
async def db_health(db: AsyncSession = Depends(get_db)) -> dict[str, str]:
    """Postgres roundtrip."""
    try:
        await db.execute(text("SELECT 1"))
        return {"status": "ok", "component": "postgres"}
    except Exception as exc:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"db unreachable: {exc}",
        ) from exc


@router.get("/redis")
async def redis_health() -> dict[str, str]:
    """Redis roundtrip."""
    try:
        redis = get_redis()
        pong = await redis.ping()
        if not pong:
            raise RuntimeError("ping returned falsy")
        return {"status": "ok", "component": "redis"}
    except Exception as exc:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"redis unreachable: {exc}",
        ) from exc
