"""Child-facing content library — serves PUBLISHED content to the mobile app.

Mirror of the admin content module, read-only and filtered to published items.
Only public-safe fields are exposed (no review/license/report internals).

  GET /content        published list, filterable by type/age_segment/language
  GET /content/{id}   full item (with body / audio_url)
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from duyo.api.deps import get_current_user, get_db
from duyo.models.content import ContentItem, ContentType
from duyo.models.user import User

router = APIRouter(prefix="/content", tags=["content"])

_MAX_LIMIT = 200


class ContentListItem(BaseModel):
    id: UUID
    type: str
    title: str
    age_segment: str
    language: str
    author: str | None
    audio_url: str | None
    likes: int

    model_config = {"from_attributes": True}


class ContentDetail(ContentListItem):
    body: str | None


@router.get("", response_model=list[ContentListItem])
async def list_content(
    type: ContentType | None = None,
    age_segment: str | None = None,
    language: str | None = None,
    limit: int = 100,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ContentListItem]:
    """Published content for the library, newest first."""
    stmt = select(ContentItem).where(ContentItem.published.is_(True))
    if type is not None:
        stmt = stmt.where(ContentItem.type == type)
    if language is not None:
        stmt = stmt.where(ContentItem.language == language)
    if age_segment is not None:
        # A child sees content for their segment plus the universal "all".
        stmt = stmt.where(ContentItem.age_segment.in_([age_segment, "all"]))
    stmt = stmt.order_by(ContentItem.created_at.desc()).limit(min(limit, _MAX_LIMIT))
    rows = (await db.scalars(stmt)).all()
    return [ContentListItem.model_validate(r) for r in rows]


@router.get("/{item_id}", response_model=ContentDetail)
async def get_content(
    item_id: UUID,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ContentDetail:
    item = await db.scalar(
        select(ContentItem).where(
            ContentItem.id == item_id, ContentItem.published.is_(True)
        )
    )
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Kontent topilmadi")
    return ContentDetail.model_validate(item)
