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
        await semantic.classify("first message", CrisisLevel.GREEN)
        await semantic.classify("second message", CrisisLevel.GREEN)

    embed_docs.assert_called_once()
