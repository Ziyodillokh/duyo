"""build_style_context — the "how to talk to this child" prompt block.

Sibling of test_goal_context.py / test_personalization.py. The behaviour
under test is entirely about the CONFIDENCE GATE: a trait only reaches the
prompt once services/style_profile.confident()/top_tags() say it has
repeated enough — see services/style_profile.py's module docstring for why
this must never become a personality/clinical label.
"""

from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from duyo.services.personalization import build_style_context


def _fake_session(profile) -> AsyncMock:
    session = AsyncMock()
    session.scalar = AsyncMock(return_value=profile)
    return session


def _profile(**kw):
    base = dict(
        length_votes={}, humor_votes={}, encouragement_votes={},
        interests={}, avoid_topics={},
    )
    base.update(kw)
    return SimpleNamespace(**base)


@pytest.mark.asyncio
async def test_none_when_no_profile_exists_yet():
    session = _fake_session(None)
    assert await build_style_context(session, uuid4()) is None


@pytest.mark.asyncio
async def test_none_below_the_confidence_floor():
    profile = _profile(length_votes={"short": 1})  # one vote is an anecdote
    session = _fake_session(profile)
    assert await build_style_context(session, uuid4()) is None


@pytest.mark.asyncio
async def test_renders_confident_length_and_humor_hints():
    profile = _profile(length_votes={"short": 3}, humor_votes={"high": 2})
    session = _fake_session(profile)
    ctx = await build_style_context(session, uuid4())
    assert ctx is not None
    assert "qisqa" in ctx
    assert "hazil" in ctx


@pytest.mark.asyncio
async def test_medium_is_silent_by_design():
    """'medium' is the implicit default tone — it must never add a line."""
    profile = _profile(length_votes={"medium": 5}, humor_votes={"medium": 5})
    session = _fake_session(profile)
    assert await build_style_context(session, uuid4()) is None


@pytest.mark.asyncio
async def test_encouragement_hint_only_fires_on_yes():
    no_profile = _profile(encouragement_votes={"no": 3})
    assert await build_style_context(_fake_session(no_profile), uuid4()) is None

    yes_profile = _profile(encouragement_votes={"yes": 2})
    ctx = await build_style_context(_fake_session(yes_profile), uuid4())
    assert ctx is not None
    assert "rag'batlantiruvchi" in ctx


@pytest.mark.asyncio
async def test_interests_and_avoid_topics_each_respect_their_own_floor():
    profile = _profile(
        interests={"futbol": 3, "kino": 1},  # "kino" below floor
        avoid_topics={"baholar": 2},
    )
    session = _fake_session(profile)
    ctx = await build_style_context(session, uuid4())
    assert ctx is not None
    assert "futbol" in ctx
    assert "kino" not in ctx
    assert "baholar" in ctx


@pytest.mark.asyncio
async def test_never_reveals_itself_to_the_child():
    profile = _profile(length_votes={"long": 2})
    ctx = await build_style_context(_fake_session(profile), uuid4())
    assert ctx is not None
    assert "hech qachon aytma" in ctx


@pytest.mark.asyncio
async def test_explicitly_disclaims_clinical_meaning():
    """Guards the property services/style_profile.py's docstring insists on:
    this block must never read as a psychology/diagnosis label."""
    profile = _profile(length_votes={"short": 2})
    ctx = await build_style_context(_fake_session(profile), uuid4())
    assert ctx is not None
    assert "klinik baho emas" in ctx


@pytest.mark.asyncio
async def test_db_error_fails_safe():
    session = AsyncMock()
    session.scalar = AsyncMock(side_effect=RuntimeError("db down"))
    assert await build_style_context(session, uuid4()) is None
