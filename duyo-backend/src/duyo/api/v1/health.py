"""Health endpoints — used by k8s/docker healthchecks and Nginx upstream probe.

Unauthenticated and publicly proxied, so the failure body says only that the
component is unavailable. It used to interpolate the exception, and asyncpg
and redis-py connection errors carry the DSN host, port and username.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from duyo.api.deps import get_db
from duyo.core.redis import get_redis

log = logging.getLogger(__name__)
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
        log.exception("health: postgres unreachable")
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="db unavailable",
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
        log.exception("health: redis unreachable")
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="redis unavailable",
        ) from exc
