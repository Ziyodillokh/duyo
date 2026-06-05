"""DTM practice questions — AI-generated, grounded in the textbook RAG."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from duyo.api.deps import get_current_user, get_db
from duyo.models.user import User
from duyo.schemas.dtm import DtmQuestion, DtmRequest, DtmResponse
from duyo.services.dtm import generate_questions

router = APIRouter(prefix="/dtm", tags=["dtm"])


@router.post("/questions", response_model=DtmResponse)
async def dtm_questions(
    payload: DtmRequest,
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DtmResponse:
    """Generate grounded DTM-style multiple-choice questions for a subject."""
    qs = await generate_questions(db, subject=payload.subject, count=payload.count)
    return DtmResponse(questions=[DtmQuestion(**q) for q in qs])
