"""Unit tests for schema validation and taxonomy lookup."""

import pytest

from duyo.textbook.schema import (
    ChunkMetadata,
    ClassifiedChunk,
    Confidence,
    ContentType,
    Difficulty,
    DocumentMeta,
    Language,
    Script,
)
from duyo.textbook.taxonomy import find_topic_id, get_topic


# ---------------------------------------------------------------------------
# DocumentMeta validation
# ---------------------------------------------------------------------------

class TestDocumentMeta:
    def test_valid_meta(self) -> None:
        meta = DocumentMeta(
            subject="matematika",
            grade=6,
            language=Language.UZ,
            script=Script.LATIN,
            source_path="textbooks/matematika/6-sinf/kasrlar.txt",
        )
        assert meta.grade == 6
        assert meta.language == Language.UZ

    def test_grade_bounds(self) -> None:
        with pytest.raises(Exception):
            DocumentMeta(subject="x", grade=0, language=Language.UZ,
                         script=Script.LATIN, source_path="x.txt")
        with pytest.raises(Exception):
            DocumentMeta(subject="x", grade=13, language=Language.UZ,
                         script=Script.LATIN, source_path="x.txt")


# ---------------------------------------------------------------------------
# ChunkMetadata defaults and copy
# ---------------------------------------------------------------------------

class TestChunkMetadata:
    def _make(self) -> ChunkMetadata:
        return ChunkMetadata(
            subject="matematika",
            grade=6,
            language=Language.UZ,
            script=Script.LATIN,
            source_path="x.txt",
        )

    def test_default_content_type(self) -> None:
        meta = self._make()
        assert meta.content_type == ContentType.EXPLANATION

    def test_default_difficulty(self) -> None:
        meta = self._make()
        assert meta.difficulty == Difficulty.UNKNOWN

    def test_default_confidence_zero(self) -> None:
        meta = self._make()
        assert meta.confidence.content_type == 0.0

    def test_model_copy_immutability(self) -> None:
        meta = self._make()
        updated = meta.model_copy(update={"content_type": ContentType.DEFINITION})
        assert meta.content_type == ContentType.EXPLANATION
        assert updated.content_type == ContentType.DEFINITION

    def test_needs_review_default_false(self) -> None:
        meta = self._make()
        assert meta.needs_review is False


# ---------------------------------------------------------------------------
# Taxonomy lookup
# ---------------------------------------------------------------------------

class TestTaxonomyLookup:
    def test_exact_alias_match(self) -> None:
        topic_id, conf = find_topic_id("Bir xil maxrajli kasrlarni qo'shish")
        assert topic_id == "math_6_fractions_add_same"
        assert conf >= 0.90

    def test_alias_variant_match(self) -> None:
        topic_id, conf = find_topic_id("bir xil maxrajli kasrlar qo'shish")
        assert topic_id == "math_6_fractions_add_same"
        assert conf >= 0.90

    def test_substring_match(self) -> None:
        topic_id, conf = find_topic_id("kasrlarni qo'shish (bir xil maxrajli)")
        assert topic_id is not None
        assert conf >= 0.60

    def test_no_match_returns_none(self) -> None:
        topic_id, conf = find_topic_id("ядерная физика")
        assert topic_id is None
        assert conf == 0.0

    def test_empty_string(self) -> None:
        topic_id, conf = find_topic_id("")
        assert topic_id is None
        assert conf == 0.0

    def test_get_topic_known_id(self) -> None:
        entry = get_topic("math_6_percent")
        assert entry is not None
        assert entry.subject == "matematika"
        assert entry.grade == 6

    def test_get_topic_unknown_id(self) -> None:
        assert get_topic("does_not_exist") is None


# ---------------------------------------------------------------------------
# Confidence bounds
# ---------------------------------------------------------------------------

class TestConfidence:
    def test_valid_confidence(self) -> None:
        c = Confidence(content_type=0.95, topic=0.80, difficulty=0.60)
        assert c.content_type == 0.95

    def test_confidence_out_of_range(self) -> None:
        with pytest.raises(Exception):
            Confidence(content_type=1.5, topic=0.5, difficulty=0.5)
        with pytest.raises(Exception):
            Confidence(content_type=-0.1, topic=0.5, difficulty=0.5)
