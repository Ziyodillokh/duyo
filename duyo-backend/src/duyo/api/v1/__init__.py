"""API v1 routers."""

from fastapi import APIRouter

from duyo.api.v1.auth import router as auth_router
from duyo.api.v1.chat import router as chat_router
from duyo.api.v1.gamification import router as gamification_router
from duyo.api.v1.health import router as health_router
from duyo.api.v1.textbook import router as textbook_router
from duyo.api.v1.voice import router as voice_router

api_v1 = APIRouter(prefix="/v1")
api_v1.include_router(health_router)
api_v1.include_router(auth_router)
api_v1.include_router(chat_router)
api_v1.include_router(voice_router)
api_v1.include_router(textbook_router)
api_v1.include_router(gamification_router)

__all__ = ["api_v1"]
