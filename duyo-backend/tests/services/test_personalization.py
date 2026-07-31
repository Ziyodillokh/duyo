"""Tests for adaptive personalization (services/personalization.py).

No model retraining involved — this just formats the child's latest cached
Report.sections into a short prompt block. DB access is mocked.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from duyo.services.personalization import build_personalization_context


def _fake_session(report) -> AsyncMock:
    session = AsyncMock()
    session.scalar = AsyncMock(return_value=report)
    return session


def _fake_report(sections: dict) -> MagicMock:
    report = MagicMock()
    report.sections = sections
    return report


@pytest.mark.asyncio
async def test_returns_none_when_no_report_exists():
    session = _fake_session(None)
    result = await build_personalization_context(session, uuid4())
    assert result is None


@pytest.mark.asyncio
async def test_returns_none_when_report_has_no_signal():
    report = _fake_report({"mood": {"mood_trend": "ma'lumot yetarli emas", "topics": [], "stress_signals": ""}})
    session = _fake_session(report)
    result = await build_personalization_context(session, uuid4())
    assert result is None


@pytest.mark.asyncio
async def test_formats_mood_trend_and_topics():
    report = _fake_report({
        "mood": {"mood_trend": "ijobiy", "topics": ["maktab", "sport"], "stress_signals": ""},
    })
    session = _fake_session(report)
    result = await build_personalization_context(session, uuid4())
    assert result is not None
    assert "ijobiy" in result
    assert "maktab" in result
    assert "sport" in result


@pytest.mark.asyncio
async def test_never_instructs_to_reveal_context_to_child():
    report = _fake_report({"mood": {"mood_trend": "barqaror", "topics": [], "stress_signals": ""}})
    session = _fake_session(report)
    result = await build_personalization_context(session, uuid4())
    assert result is not None
    assert "hech qachon aytma" in result


@pytest.mark.asyncio
async def test_fails_safe_on_db_error():
    session = AsyncMock()
    session.scalar = AsyncMock(side_effect=RuntimeError("db down"))
    result = await build_personalization_context(session, uuid4())
    assert result is None
