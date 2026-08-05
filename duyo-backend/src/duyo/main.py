"""DUYO Backend — FastAPI application entrypoint."""

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from duyo import __version__
from duyo.api.v1 import api_v1
from duyo.core.config import get_settings
from duyo.crisis.router import router as crisis_router

log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    """Startup / shutdown — currently a no-op (Redis/DB connections are lazy)."""
    settings = get_settings()
    log.info("DUYO backend starting up (v%s, env=%s)", __version__, settings.app_env)
    if settings.otp_demo_code:
        # Loud on every start: this is the one setting that, left on, hands
        # any stranger any family's account.
        log.warning(
            "OTP DEMO CODE ACTIVE — every phone number accepts %r. "
            "Intended only while no SMS provider is connected. "
            "Clear OTP_DEMO_CODE to turn it off.",
            settings.otp_demo_code,
        )
    yield
    log.info("DUYO backend shutting down")


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="DUYO Backend",
        description="AI Companion for Children — backend services",
        version=__version__,
        debug=settings.app_debug,
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"] if settings.app_debug else [],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health", tags=["meta"])
    async def root_health() -> dict[str, str]:
        """Top-level liveness (sub-routes have /v1/health/db and /v1/health/redis)."""
        return {"status": "ok", "version": __version__, "env": settings.app_env}

    app.include_router(api_v1)
    app.include_router(crisis_router, prefix="/v1/internal")  # internal-only

    return app


app = create_app()
