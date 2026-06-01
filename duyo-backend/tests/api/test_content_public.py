"""Child-facing content library — published list + detail + 404."""

import asyncio
from dataclasses import dataclass, field
from datetime import UTC, datetime
from uuid import uuid4

import pytest
from fastapi import HTTPException

from duyo.api.v1 import content as content_api
from duyo.models.content import ContentItem, ContentType


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


@dataclass
class _ScalarResult:
    rows: list

    def all(self):
        return self.rows


@dataclass
class _FakeSession:
    scalar_value: object = None
    list_rows: list = field(default_factory=list)

    async def scalar(self, *_a, **_kw):
        return self.scalar_value

    async def scalars(self, *_a, **_kw):
        return _ScalarResult(list(self.list_rows))


def _item(published=True, type_=ContentType.POEM) -> ContentItem:
    it = ContentItem(
        type=type_, title="Bahor", body="She'r matni", age_segment="all",
        language="uz", author="Anon", published=published,
    )
    it.id = uuid4()
    it.audio_url = None
    it.likes = 3
    it.created_at = datetime.now(UTC)
    return it


def test_list_returns_published_items():
    db = _FakeSession(list_rows=[_item(), _item(type_=ContentType.STORY)])
    rows = _run(content_api.list_content(_=None, db=db))
    assert len(rows) == 2
    assert rows[0].title == "Bahor"
    # list items expose only public-safe fields (no review/license/reports)
    assert not hasattr(rows[0], "review_status")


def test_detail_returns_body():
    item = _item()
    db = _FakeSession(scalar_value=item)
    detail = _run(content_api.get_content(item_id=item.id, _=None, db=db))
    assert detail.body == "She'r matni"
    assert detail.likes == 3


def test_detail_404_when_missing_or_unpublished():
    db = _FakeSession(scalar_value=None)  # query filters published; missing → None
    with pytest.raises(HTTPException) as exc:
        _run(content_api.get_content(item_id=uuid4(), _=None, db=db))
    assert exc.value.status_code == 404
