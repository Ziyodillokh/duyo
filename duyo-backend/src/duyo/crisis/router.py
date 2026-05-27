"""FastAPI router for the Crisis Detection service (Layer 1 only for now).

Internal-only endpoints — the public chat service will call these inline
before persisting any user message.
"""

from __future__ import annotations

from functools import lru_cache

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from duyo.crisis.detector import (
    CrisisCategory,
    CrisisLevel,
    KeywordCrisisDetector,
)

router = APIRouter(prefix="/crisis", tags=["crisis"])


@lru_cache(maxsize=1)
def get_detector() -> KeywordCrisisDetector:
    """Singleton — build the keyword index once per process."""
    return KeywordCrisisDetector()


class CrisisCheckRequest(BaseModel):
    text: str = Field(min_length=1, max_length=4000)


class CrisisCheckMatch(BaseModel):
    keyword: str
    category: CrisisCategory
    language: str


class CrisisCheckResponse(BaseModel):
    level: CrisisLevel
    matches: list[CrisisCheckMatch]
    is_safe: bool


@router.post("/check", response_model=CrisisCheckResponse)
async def check_text(
    payload: CrisisCheckRequest,
    detector: KeywordCrisisDetector = Depends(get_detector),
) -> CrisisCheckResponse:
    """Run Layer 1 keyword detection on a single text message."""
    result = detector.check(payload.text)
    return CrisisCheckResponse(
        level=result.level,
        is_safe=result.is_safe,
        matches=[
            CrisisCheckMatch(keyword=m.keyword, category=m.category, language=m.language.value)
            for m in result.matches
        ],
    )
