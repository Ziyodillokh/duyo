"""Tests for the Layer 3 semantic crisis classifier.

All embedding calls are mocked — these tests verify the classification
arithmetic (cosine similarity, threshold mapping, never-downgrade policy,
anchor caching) and fail-safe behaviour, not real embedding quality.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from duyo.crisis import semantic
from duyo.crisis.keywords import CrisisCategory
from duyo.models.crisis_event import CrisisLevel


class _FakeSettings:
    crisis_threshold_yellow = 0.5
    crisis_threshold_orange = 0.7
    crisis_threshold_red = 0.9


@pytest.fixture(autouse=True)
def _clear_anchor_cache():
    semantic.reset_cache()
    yield
    semantic.reset_cache()


@pytest.fixture(autouse=True)
def _fake_settings():
    with patch("duyo.crisis.semantic.get_settings", return_value=_FakeSettings()):
        yield


# ---------------------------------------------------------------------------
# Pure helpers
# ---------------------------------------------------------------------------


def test_cosine_identical_vectors_is_one():
    assert semantic._cosine([1.0, 0.0], [1.0, 0.0]) == pytest.approx(1.0)


def test_cosine_orthogonal_vectors_is_zero():
    assert semantic._cosine([1.0, 0.0], [0.0, 1.0]) == pytest.approx(0.0)


@pytest.mark.parametrize(
    "score,expected",
    [
        (0.95, CrisisLevel.RED),
        (0.9, CrisisLevel.RED),
        (0.8, CrisisLevel.ORANGE),
        (0.7, CrisisLevel.ORANGE),
        (0.6, CrisisLevel.YELLOW),
        (0.5, CrisisLevel.YELLOW),
        (0.1, CrisisLevel.GREEN),
    ],
)
def test_level_for_score_matches_thresholds(score, expected):
    assert semantic._level_for_score(score) == expected


# ---------------------------------------------------------------------------
# classify() — mocked embeddings
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_classify_escalates_on_high_similarity():
    with (
        patch("duyo.crisis.semantic._flatten_anchors", return_value=[("o'lgim keladi", CrisisCategory.SUICIDAL)]),
        patch("duyo.crisis.semantic.embed_documents", AsyncMock(return_value=[[1.0, 0.0]])),
        patch("duyo.crisis.semantic.embed_query", AsyncMock(return_value=[0.95, 0.0])),
    ):
        # Warming is no longer done inline on a request — see
        # crisis/semantic.py. A cold layer deliberately skips the message.
        await semantic.warm_anchors()
        result = await semantic.classify("hech kim meni sevmaydi", CrisisLevel.GREEN)

    assert result.level == CrisisLevel.RED
    assert result.category == CrisisCategory.SUICIDAL
    assert result.closest_phrase == "o'lgim keladi"
    assert result.confidence == pytest.approx(0.95)


@pytest.mark.asyncio
async def test_classify_never_downgrades_below_current_level():
    """Even a GREEN-scoring message must not undo an ORANGE Layer 1/2 result."""
    with (
        patch("duyo.crisis.semantic._flatten_anchors", return_value=[("safe phrase", CrisisCategory.SUICIDAL)]),
        patch("duyo.crisis.semantic.embed_documents", AsyncMock(return_value=[[1.0, 0.0]])),
        patch("duyo.crisis.semantic.embed_query", AsyncMock(return_value=[0.0, 1.0])),  # orthogonal → ~0 similarity
    ):
        await semantic.warm_anchors()
        result = await semantic.classify("salom, bugun quyoshli", CrisisLevel.ORANGE)

    assert result.level == CrisisLevel.ORANGE


@pytest.mark.asyncio
async def test_classify_fails_safe_on_embedding_error():
    with patch("duyo.crisis.semantic._get_anchors", AsyncMock(side_effect=RuntimeError("api down"))):
        result = await semantic.classify("istalgan matn", CrisisLevel.YELLOW)

    assert result.level == CrisisLevel.YELLOW
    assert result.confidence == 0.0
    assert result.category is None


@pytest.mark.asyncio
async def test_anchor_embeddings_are_cached_across_calls():
    embed_docs = AsyncMock(return_value=[[1.0, 0.0]])
    with (
        patch("duyo.crisis.semantic._flatten_anchors", return_value=[("phrase", CrisisCategory.SUICIDAL)]),
        patch("duyo.crisis.semantic.embed_documents", embed_docs),
        patch("duyo.crisis.semantic.embed_query", AsyncMock(return_value=[0.0, 1.0])),
    ):
        await semantic.warm_anchors()
        await semantic.warm_anchors()  # idempotent
        await semantic.classify("first message", CrisisLevel.GREEN)
        await semantic.classify("second message", CrisisLevel.GREEN)

    embed_docs.assert_called_once()


# ---------------------------------------------------------------------------
# Cold-start behaviour — the defect that killed chat entirely.
#
# There are 217 anchor phrases and gemini-embedding-001 takes one text per
# call, so warming this cache is 217 SEQUENTIAL API calls, about a minute.
# Building it inline on the first chat turn after every restart made that turn
# take ~68 seconds; the mobile client gave up first, its disconnect cancelled
# the warm-up, the cache was never populated, and the next turn started the
# same 217 calls again. Chat was permanently dead from the first deploy on.
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_a_cold_layer_returns_immediately_without_embedding_anything():
    """The property that matters: a cold Layer 3 must not make the child wait."""
    semantic.reset_cache()
    embed_docs = AsyncMock(return_value=[[1.0, 0.0]])
    embed_q = AsyncMock(return_value=[1.0, 0.0])

    with (
        patch("duyo.crisis.semantic._flatten_anchors",
              return_value=[("o'lgim keladi", CrisisCategory.SUICIDAL)]),
        patch("duyo.crisis.semantic.embed_documents", embed_docs),
        patch("duyo.crisis.semantic.embed_query", embed_q),
        patch("duyo.crisis.semantic._spawn_warm_up"),  # don't warm in this test
    ):
        result = await semantic.classify("hech kim meni sevmaydi", CrisisLevel.GREEN)

    # Nothing was embedded on the request path.
    embed_docs.assert_not_called()
    embed_q.assert_not_called()
    # And the level is unchanged rather than invented.
    assert result.level == CrisisLevel.GREEN
    assert result.confidence == 0.0


@pytest.mark.asyncio
async def test_a_cold_layer_never_downgrades_what_layers_1_and_2_found():
    """Skipping Layer 3 must lose an escalation at worst, never cause one."""
    semantic.reset_cache()
    with (
        patch("duyo.crisis.semantic._flatten_anchors", return_value=[]),
        patch("duyo.crisis.semantic._spawn_warm_up"),
    ):
        for level in CrisisLevel:
            result = await semantic.classify("istalgan xabar", level)
            assert result.level == level


@pytest.mark.asyncio
async def test_a_cold_message_kicks_off_a_background_warm_up():
    """The layer must recover on its own even if the startup hook never ran."""
    semantic.reset_cache()
    with (
        patch("duyo.crisis.semantic._flatten_anchors", return_value=[]),
        patch("duyo.crisis.semantic._spawn_warm_up") as spawn,
    ):
        await semantic.classify("xabar", CrisisLevel.GREEN)
    spawn.assert_called_once()


@pytest.mark.asyncio
async def test_warming_reports_readiness():
    semantic.reset_cache()
    assert semantic.anchors_ready() is False
    with (
        patch("duyo.crisis.semantic._flatten_anchors",
              return_value=[("phrase", CrisisCategory.SUICIDAL)]),
        patch("duyo.crisis.semantic.embed_documents",
              AsyncMock(return_value=[[1.0, 0.0]])),
    ):
        await semantic.warm_anchors()
    assert semantic.anchors_ready() is True


@pytest.mark.asyncio
async def test_a_failed_warm_up_leaves_the_layer_cold_rather_than_broken():
    """Layers 1 and 2 keep screening; Layer 3 simply stays off."""
    semantic.reset_cache()
    with (
        patch("duyo.crisis.semantic._flatten_anchors", return_value=[("p", CrisisCategory.SUICIDAL)]),
        patch("duyo.crisis.semantic.embed_documents",
              AsyncMock(side_effect=RuntimeError("embedding API down"))),
    ):
        await semantic.warm_anchors()  # must not raise
    assert semantic.anchors_ready() is False


def test_the_app_warms_the_layer_at_startup_without_awaiting_it():
    """Awaiting it would delay every restart by a minute; not starting it at
    all would leave Layer 3 off until the first message arrived."""
    import inspect

    from duyo.main import lifespan

    source = inspect.getsource(lifespan)
    assert "warm_anchors" in source
    assert "create_task" in source
    # Explicitly NOT awaited inline.
    assert "await warm_anchors()" not in source
