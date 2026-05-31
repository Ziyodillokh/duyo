"""v1 API router aggregation."""

from fastapi import APIRouter

from duyo.api.v1 import auth, chat, gamification, health, textbook, voice

api_router = APIRouter(prefix="/v1")
api_router.include_router(auth.router)
api_router.include_router(chat.router)
api_router.include_router(health.router)
api_router.include_router(textbook.router)
api_router.include_router(voice.router)
api_router.include_router(gamification.router)
