"""DUYO Backend — FastAPI application entrypoint."""

import asyncio
import contextlib
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from duyo import __version__
from duyo.api.v1 import api_v1
from duyo.core.config import get_settings
from duyo.crisis.semantic import warm_anchors

log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    """Startup / shutdown. DB and Redis connections stay lazy."""
    settings = get_settings()
    log.info("DUYO backend starting up (v%s, env=%s)", __version__, settings.app_env)

    # SMS that cannot actually be delivered. The stub reports success while
    # sending nothing, so logins hand out codes nobody receives and crisis
    # alerts are recorded as delivered while reaching no parent.
    #
    # Logged, not raised. Refusing to boot was the stronger guard and briefly
    # what this did — but the deploy is health-gated, so on a box already in
    # this state it rolled every release back, including the one that closed
    # a family-linking hole. A guard that blocks the fix for a worse problem
    # is not worth its strictness. Make it fatal again once the environment
    # is known good.
    sms_problem = settings.sms_misconfigured_for_production()
    if sms_problem:
        log.error("SMS MISCONFIGURED — %s", sms_problem)

    if settings.otp_demo_code:
        # Loud on every start: this is the one setting that, left on, hands
        # any stranger any family's account.
        log.warning(
            "OTP DEMO CODE ACTIVE — every phone number accepts %r. "
            "Intended only while no SMS provider is connected. "
            "Clear OTP_DEMO_CODE to turn it off.",
            settings.otp_demo_code,
        )

    # Crisis Layer 3's anchor embeddings: 217 sequential embedding calls, about
    # a minute. Started here, in the background, because doing it on the first
    # chat turn is exactly what broke chat — see crisis/semantic.py. Not
    # awaited: the app must accept traffic immediately, and Layers 1 and 2
    # screen every message meanwhile.
    warm_task = asyncio.create_task(warm_anchors())

    yield

    if not warm_task.done():
        warm_task.cancel()
        with contextlib.suppress(asyncio.CancelledError, Exception):
            await warm_task
    log.info("DUYO backend shutting down")


def create_app() -> FastAPI:
    settings = get_settings()

    # Swagger, ReDoc and the schema itself are off in production. They were
    # live on api.duyo.uz, publishing all 132 routes including every admin
    # path — which turns "find the unguarded endpoint" from a guess into a
    # one-minute read. Nothing in the product consumes them at runtime.
    is_production = settings.app_env == "production"

    app = FastAPI(
        title="DUYO Backend",
        description="AI Companion for Children — backend services",
        version=__version__,
        debug=settings.app_debug,
        lifespan=lifespan,
        docs_url=None if is_production else "/docs",
        redoc_url=None if is_production else "/redoc",
        openapi_url=None if is_production else "/openapi.json",
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

    # crisis.router is NOT mounted. It was, under /v1/internal, with no auth
    # dependency and behind an nginx that proxies everything — so POST
    # /v1/internal/crisis/check answered anyone, returning the matched keyword
    # and its category. That is the safety filter's own oracle: enough queries
    # and you have the RED/ORANGE dictionary, and with it a message that
    # passes Layer 1 on the voice stream and on every note write. Nothing
    # calls it over HTTP — chat.py, note.py and social.py all take the same
    # detector in-process via Depends(get_detector).

    return app


app = create_app()
