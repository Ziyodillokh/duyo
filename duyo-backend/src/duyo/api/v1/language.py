"""Language-practice questions — content-library grounded, AI-generated."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from duyo.api.deps import get_current_user, get_db
from duyo.models.user import User
from duyo.schemas.language import (
    LanguagePracticeRequest,
    LanguagePracticeResponse,
    LanguageQuestion,
)
from duyo.services.language import generate_practice

router = APIRouter(prefix="/language", tags=["language"])


@router.post("/exercises", response_model=LanguagePracticeResponse)
async def language_exercises(
    payload: LanguagePracticeRequest,
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> LanguagePracticeResponse:
    """Generate age-appropriate language-practice MCQs (Til mashqlari)."""
    qs = await generate_practice(
        db,
        language=payload.language,
        age_segment=payload.age_segment,
        topic=payload.topic,
        count=payload.count,
    )
    return LanguagePracticeResponse(questions=[LanguageQuestion(**q) for q in qs])
