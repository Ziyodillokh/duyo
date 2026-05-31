"""Chat daily-limit enforcement — 429 before any LLM work (Concept §12.1)."""

import asyncio
from dataclasses import dataclass, field
from uuid import uuid4

import pytest
from fastapi import HTTPException

from duyo.api.v1 import chat as chat_module
from duyo.billing.limits import LimitStatus
from duyo.schemas.chat import ChatRequest


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


@dataclass
class _FakeSession:
    scalar_queue: list = field(default_factory=list)

    async def scalar(self, *_a, **_kw):
        return self.scalar_queue.pop(0)


@dataclass
class _User:
    id: object
    phone: str = "+998901112233"


def _child(parent_id):
    c = type("C", (), {})()
    c.id = uuid4()
    c.parent_id = parent_id
    return c


def test_chat_blocked_when_over_limit(monkeypatch):
    """Over-limit → 429, and no conversation/LLM work happens."""
    user = _User(uuid4())
    child = _child(user.id)
    # Only the child lookup scalar is consumed before the limit check fires.
    db = _FakeSession(scalar_queue=[child])

    async def _blocked(session, user_id, *, now=None):
        return LimitStatus(allowed=False, limit=20, used=20, tier="free")
    monkeypatch.setattr(chat_module, "check_daily_message_limit", _blocked)

    # detector is unused before the limit check, so a dummy is fine.
    with pytest.raises(HTTPException) as exc:
        _run(chat_module.chat_turn(
            payload=ChatRequest(child_id=child.id, message="salom"),
            background_tasks=None,
            current_user=user,
            db=db,
            detector=object(),
        ))
    assert exc.value.status_code == 429
    assert "chegarasi" in exc.value.detail
    # The child scalar was consumed; nothing else was queried (no LLM path).
    assert db.scalar_queue == []


def test_chat_child_not_found_before_limit(monkeypatch):
    """A missing child still 404s (limit check never reached)."""
    user = _User(uuid4())
    db = _FakeSession(scalar_queue=[None])

    async def _should_not_run(*_a, **_kw):
        raise AssertionError("limit check must not run when child is missing")
    monkeypatch.setattr(chat_module, "check_daily_message_limit", _should_not_run)

    with pytest.raises(HTTPException) as exc:
        _run(chat_module.chat_turn(
            payload=ChatRequest(child_id=uuid4(), message="salom"),
            background_tasks=None,
            current_user=user,
            db=db,
            detector=object(),
        ))
    assert exc.value.status_code == 404
