"""The child's profile photo — upload, delete, serve.

Endpoint functions are called directly with a fake AsyncSession, matching
tests/api/test_children.py. Storage is faked too: these assert the route's
gates, and a route that reaches a real MinIO in a unit test is a route whose
gates are untested on the day the bucket is unreachable.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from uuid import uuid4

import pytest
from fastapi import HTTPException

from duyo.api.v1 import chat as chat_module
from duyo.core import storage
from duyo.models.child import AgeSegment, ChildProfile, Language


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


@dataclass
class _FakeResult:
    rows: list

    def scalar_one_or_none(self):
        return self.rows[0] if self.rows else None


@dataclass
class _FakeSession:
    result: _FakeResult
    flushed: bool = False

    async def execute(self, *_a, **_kw):
        return self.result

    async def flush(self):
        self.flushed = True


@dataclass
class _FakeUser:
    id: object


@dataclass
class _FakeUpload:
    """The two bits of UploadFile the route touches."""

    payload: bytes
    content_type: str = "image/jpeg"

    async def read(self):
        return self.payload


@dataclass
class _Recorder:
    """Stands in for core.storage, recording what the route asked of it."""

    uploaded: list = field(default_factory=list)
    key: str = "abc123.jpg"

    def upload(self, data, content_type):
        self.uploaded.append((len(data), content_type))
        return self.key


def _child(parent_id, photo_key=None) -> ChildProfile:
    c = ChildProfile(
        parent_id=parent_id,
        name="Aziza",
        age=12,
        age_segment=AgeSegment.from_age(12),
        language=Language.UZ,
    )
    c.id = uuid4()
    c.photo_key = photo_key
    return c


@pytest.fixture
def world():
    user = _FakeUser(id=uuid4())
    child = _child(user.id)
    return user, child, _FakeSession(result=_FakeResult([child]))


@pytest.fixture
def fake_storage(monkeypatch):
    rec = _Recorder()
    monkeypatch.setattr(chat_module.storage, "upload", rec.upload)
    return rec


# --- upload -----------------------------------------------------------------


def test_a_photo_is_stored_and_the_key_lands_on_the_profile(world, fake_storage):
    user, child, session = world

    out = _run(
        chat_module.upload_child_photo(
            child.id, _FakeUpload(b"x" * 1000), current_user=user, db=session
        )
    )

    assert fake_storage.uploaded == [(1000, "image/jpeg")]
    assert out.photo_key == "abc123.jpg"
    assert session.flushed


def test_the_url_carries_the_key_so_a_new_photo_is_a_new_address(world, fake_storage):
    """Without the cache-buster the address never changes and every cache in
    the path keeps serving the picture the child just replaced."""
    user, child, session = world

    out = _run(
        chat_module.upload_child_photo(
            child.id, _FakeUpload(b"x" * 10), current_user=user, db=session
        )
    )

    assert out.photo_url is not None
    assert out.photo_url.endswith("/photo?v=abc123.jpg")
    # The AUTHENTICATED route, never the public media one.
    assert "/v1/content/media/" not in out.photo_url


def test_a_child_with_no_photo_has_no_url(world):
    _user, child, _session = world
    assert child.photo_key is None
    assert child.photo_url is None


def test_a_pdf_is_refused_even_though_storage_would_take_it(world, fake_storage):
    """storage.upload's allowlist is the union of everything the app uploads
    anywhere, so narrowing to images has to happen in the route."""
    user, child, session = world

    with pytest.raises(HTTPException) as exc:
        _run(
            chat_module.upload_child_photo(
                child.id,
                _FakeUpload(b"%PDF-1.4", content_type="application/pdf"),
                current_user=user,
                db=session,
            )
        )

    assert exc.value.status_code == 415
    assert fake_storage.uploaded == []
    assert child.photo_key is None


def test_an_oversized_photo_is_refused_before_it_reaches_storage(world, fake_storage):
    user, child, session = world

    with pytest.raises(HTTPException) as exc:
        _run(
            chat_module.upload_child_photo(
                child.id,
                _FakeUpload(b"x" * (chat_module._MAX_PHOTO_BYTES + 1)),
                current_user=user,
                db=session,
            )
        )

    assert exc.value.status_code == 413
    assert fake_storage.uploaded == []


def test_an_empty_file_is_refused(world, fake_storage):
    user, child, session = world

    with pytest.raises(HTTPException) as exc:
        _run(
            chat_module.upload_child_photo(
                child.id, _FakeUpload(b""), current_user=user, db=session
            )
        )

    assert exc.value.status_code == 400
    assert fake_storage.uploaded == []


def test_a_content_type_with_parameters_still_matches(world, fake_storage):
    """A phone can send `image/jpeg; charset=binary`. Matching the raw header
    against the allowlist would reject it."""
    user, child, session = world

    _run(
        chat_module.upload_child_photo(
            child.id,
            _FakeUpload(b"x" * 10, content_type="image/jpeg; charset=binary"),
            current_user=user,
            db=session,
        )
    )

    assert child.photo_key == "abc123.jpg"


def test_replacing_a_photo_does_not_delete_the_old_object(world, fake_storage, monkeypatch):
    """A failed write that has already dropped the previous file leaves the
    child with no photo at all, which is worse than an orphan in a bucket."""
    removed = []
    monkeypatch.setattr(
        chat_module.storage, "get_object", lambda k: removed.append(k), raising=False
    )
    user, child, session = world
    child.photo_key = "old.jpg"

    _run(
        chat_module.upload_child_photo(
            child.id, _FakeUpload(b"x" * 10), current_user=user, db=session
        )
    )

    assert child.photo_key == "abc123.jpg"
    assert removed == []


# --- delete -----------------------------------------------------------------


def test_deleting_the_photo_goes_back_to_the_mascot(world):
    user, child, session = world
    child.photo_key = "abc123.jpg"

    out = _run(
        chat_module.delete_child_photo(child.id, current_user=user, db=session)
    )

    assert out.photo_key is None
    assert out.photo_url is None
    assert session.flushed


# --- serve ------------------------------------------------------------------


def test_serving_a_missing_photo_is_a_404_not_a_crash(world):
    user, child, session = world

    with pytest.raises(HTTPException) as exc:
        _run(chat_module.get_child_photo(child.id, current_user=user, db=session))

    assert exc.value.status_code == 404


def test_a_vanished_object_is_a_404_not_a_500(world, monkeypatch):
    """The row can outlive the file — a bucket restore, a manual delete."""
    user, child, session = world
    child.photo_key = "gone.jpg"

    def boom(_key):
        raise storage.S3Error("NoSuchKey", "gone", "r", "h", "i", "resp")

    monkeypatch.setattr(chat_module.storage, "get_object", boom)

    with pytest.raises(HTTPException) as exc:
        _run(chat_module.get_child_photo(child.id, current_user=user, db=session))

    assert exc.value.status_code == 404


def test_the_photo_is_never_cached_publicly(world, monkeypatch):
    """A shared cache must not hold one child's face where another request
    can reach it — /v1/content/media sends `public`, this must not."""
    user, child, session = world
    child.photo_key = "abc123.jpg"
    monkeypatch.setattr(
        chat_module.storage, "get_object", lambda _k: (iter([b""]), "image/jpeg", 0)
    )

    resp = _run(chat_module.get_child_photo(child.id, current_user=user, db=session))

    assert resp.headers["cache-control"].startswith("private")


# --- ownership --------------------------------------------------------------


def test_someone_elses_child_is_a_404_on_every_photo_route(fake_storage):
    """404 rather than 403, so existence never leaks — the same rule the rest
    of the child routes follow."""
    stranger = _FakeUser(id=uuid4())
    empty = _FakeSession(result=_FakeResult([]))
    other_id = uuid4()

    for call in (
        lambda: chat_module.upload_child_photo(
            other_id, _FakeUpload(b"x"), current_user=stranger, db=empty
        ),
        lambda: chat_module.delete_child_photo(
            other_id, current_user=stranger, db=empty
        ),
        lambda: chat_module.get_child_photo(other_id, current_user=stranger, db=empty),
    ):
        with pytest.raises(HTTPException) as exc:
            _run(call())
        assert exc.value.status_code == 404
