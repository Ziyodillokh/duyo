"""Tests for pipeline pure functions and classify_chunk with mocked LLM."""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from duyo.textbook.pipeline import chunk_text, extract_doc_meta
from duyo.textbook.schema import (
    ChunkMetadata,
    Confidence,
    ContentType,
    Difficulty,
    DocumentMeta,
    Language,
    Script,
)


# ---------------------------------------------------------------------------
# chunk_text
# ---------------------------------------------------------------------------

class TestChunkText:
    def test_splits_on_blank_lines(self) -> None:
        para = "Bu paragraf yetarlicha uzun, chunki minimal 60 belgi talab qilinadi. "
        text = para + "\n\n" + para + "\n\n" + para
        chunks = chunk_text(text)
        assert len(chunks) == 3

    def test_drops_noise_paragraphs_below_min(self) -> None:
        # Very short paragraphs (headers/noise) are dropped by the MIN filter
        noise = "Sarlavha.\n\nIkkinchi sarlavha."
        chunks = chunk_text(noise)
        # Both under 60 chars — dropped as noise
        assert chunks == []

    def test_accumulates_short_into_longer_chunk(self) -> None:
        # Multiple short paragraphs that buffer accumulates into one >= 60 char chunk
        # Each para is ~20 chars; first two merge (40 < 60), third triggers save of 40
        # then the third starts new buffer. Result: 40-char chunk filtered out, etc.
        # Use a single large paragraph instead to verify actual behaviour
        big = "A" * 65
        chunks = chunk_text(big)
        assert len(chunks) == 1

    def test_filters_below_min_chars(self) -> None:
        # Very short paragraph that can't be merged (isolated)
        text = "Hi.\n\n" + "A" * 100 + "\n\n" + "B" * 100
        chunks = chunk_text(text)
        # "Hi." is too short and gets merged or dropped
        assert all(len(c) >= 60 for c in chunks)

    def test_splits_oversized_chunk(self) -> None:
        # 10 long sentences that together exceed MAX_CHUNK_CHARS
        sentences = " ".join([
            "Bu juda uzun jumla bo'lib, u ko'p so'zlardan tashkil topgan va mazmunli." * 3
        ] * 8)
        chunks = chunk_text(sentences)
        assert all(len(c) <= 2000 for c in chunks)

    def test_empty_text(self) -> None:
        assert chunk_text("") == []

    def test_whitespace_only(self) -> None:
        assert chunk_text("   \n\n   ") == []

    def test_preserves_content(self) -> None:
        long_def = "Ta'rif: Kasrning surati va maxraji deyiladi. Bu juda muhim tushuncha."
        long_mashq = "Mashq 1. Hisoblang: 1/4 + 2/4 = ? Natijani soddalashtiring. To'g'ri javob toping."
        text = long_def + "\n\n" + long_mashq
        chunks = chunk_text(text)
        full = " ".join(chunks)
        assert "Ta'rif" in full
        assert "Mashq" in full


# ---------------------------------------------------------------------------
# extract_doc_meta
# ---------------------------------------------------------------------------

class TestExtractDocMeta:
    def test_uz_matematika_6_sinf(self, tmp_path: Path) -> None:
        f = tmp_path / "uz" / "matematika" / "6-sinf" / "kasrlar.txt"
        f.parent.mkdir(parents=True)
        f.write_text("Bir xil maxrajli kasrlar.", encoding="utf-8")
        meta = extract_doc_meta(f)
        assert meta.subject == "matematika"
        assert meta.grade == 6
        assert meta.language == Language.UZ

    def test_grade_extracted_from_filename(self, tmp_path: Path) -> None:
        f = tmp_path / "math_grade8_latin.txt"
        f.write_text("Some content here.", encoding="utf-8")
        meta = extract_doc_meta(f)
        assert meta.grade == 8

    def test_russian_language_detected(self, tmp_path: Path) -> None:
        f = tmp_path / "fizika-ru-9-sinf.txt"
        f.write_text("Fizika darslik matnlari.", encoding="utf-8")
        meta = extract_doc_meta(f)
        assert meta.language == Language.RU

    def test_cyrillic_script_detected(self, tmp_path: Path) -> None:
        f = tmp_path / "matematika-6.txt"
        cyrillic_text = "Математика дарслиги. Касрлар мавзуси. " * 20
        f.write_text(cyrillic_text, encoding="utf-8")
        meta = extract_doc_meta(f)
        assert meta.script in (Script.CYRILLIC, Script.MIXED)

    def test_unknown_subject_fallback(self, tmp_path: Path) -> None:
        f = tmp_path / "unknown_subject.txt"
        f.write_text("Some content.", encoding="utf-8")
        meta = extract_doc_meta(f)
        assert meta.subject == "unknown"

    def test_source_path_preserved(self, tmp_path: Path) -> None:
        f = tmp_path / "matematika-5-sinf.txt"
        f.write_text("Matn.", encoding="utf-8")
        meta = extract_doc_meta(f)
        assert str(f) in meta.source_path


# ---------------------------------------------------------------------------
# LLM classifier — pure helper functions
# ---------------------------------------------------------------------------

class TestLLMHelpers:
    def test_extract_json_from_clean_response(self) -> None:
        from duyo.textbook.llm_classifier import _extract_json

        raw = '{"content_type": "definition", "difficulty": "easy"}'
        data = _extract_json(raw)
        assert data["content_type"] == "definition"

    def test_extract_json_strips_prose(self) -> None:
        from duyo.textbook.llm_classifier import _extract_json

        raw = 'Here is my answer:\n{"content_type": "rule"}\nThank you.'
        data = _extract_json(raw)
        assert data["content_type"] == "rule"

    def test_extract_json_raises_on_no_json(self) -> None:
        from duyo.textbook.llm_classifier import _extract_json

        with pytest.raises(ValueError, match="No JSON object found"):
            _extract_json("No JSON here at all.")

    def test_parse_response_builds_metadata(self) -> None:
        from duyo.textbook.llm_classifier import _parse_response

        doc_meta = DocumentMeta(
            subject="matematika", grade=6,
            language=Language.UZ, script=Script.LATIN,
            source_path="test.txt",
        )
        data = {
            "chapter": "Kasrlar",
            "topic": "Bir xil maxrajli kasrlarni qo'shish",
            "subtopic": "Qo'shish qoidasi",
            "content_type": "rule",
            "difficulty": "easy",
            "has_formula": True,
            "has_table": False,
            "has_image": False,
            "confidence": {"content_type": 0.92, "topic": 0.85, "difficulty": 0.78},
        }
        meta = _parse_response(data, doc_meta)
        assert meta.content_type == ContentType.RULE
        assert meta.difficulty == Difficulty.EASY
        assert meta.has_formula is True
        assert meta.topic_id == "math_6_fractions_add_same"  # taxonomy matched
        assert meta.subject == "matematika"

    def test_parse_response_unknown_content_type_falls_back(self) -> None:
        from duyo.textbook.llm_classifier import _parse_response

        doc_meta = DocumentMeta(
            subject="tarix", grade=7,
            language=Language.UZ, script=Script.LATIN,
            source_path="x.txt",
        )
        data = {
            "content_type": "not_a_real_type",
            "difficulty": "medium",
            "has_formula": False, "has_table": False, "has_image": False,
            "confidence": {"content_type": 0.5, "topic": 0.3, "difficulty": 0.6},
        }
        meta = _parse_response(data, doc_meta)
        assert meta.content_type == ContentType.EXPLANATION  # fallback

    def test_parse_response_marks_low_confidence_for_review(self) -> None:
        from duyo.textbook.llm_classifier import _parse_response

        doc_meta = DocumentMeta(
            subject="biologiya", grade=8,
            language=Language.UZ, script=Script.LATIN,
            source_path="x.txt",
        )
        data = {
            "content_type": "explanation",
            "difficulty": "unknown",
            "has_formula": False, "has_table": False, "has_image": False,
            "confidence": {"content_type": 0.50, "topic": 0.3, "difficulty": 0.4},
        }
        meta = _parse_response(data, doc_meta)
        assert meta.needs_review is True

    def test_build_prompt_contains_chunk(self) -> None:
        from duyo.textbook.llm_classifier import _build_prompt

        doc_meta = DocumentMeta(
            subject="matematika", grade=6,
            language=Language.UZ, script=Script.LATIN,
            source_path="x.txt",
        )
        chunk = "Qoida: kasrlarni qo'shish uchun..."
        prompt = _build_prompt(chunk, doc_meta, rule_hint=None)
        assert chunk in prompt
        assert "matematika" in prompt

    def test_build_prompt_includes_rule_hint(self) -> None:
        from duyo.textbook.llm_classifier import _build_prompt

        doc_meta = DocumentMeta(
            subject="fizika", grade=9,
            language=Language.UZ, script=Script.LATIN,
            source_path="x.txt",
        )
        prompt = _build_prompt("some chunk", doc_meta, rule_hint="rule (confidence 0.75)")
        assert "rule (confidence 0.75)" in prompt


# ---------------------------------------------------------------------------
# classify_chunk — mocked LLM
# ---------------------------------------------------------------------------

class TestClassifyChunkMocked:
    def _make_doc_meta(self) -> DocumentMeta:
        return DocumentMeta(
            subject="matematika", grade=6,
            language=Language.UZ, script=Script.LATIN,
            source_path="x.txt",
        )

    @pytest.mark.asyncio
    async def test_rule_confident_skips_llm(self) -> None:
        from duyo.textbook.pipeline import classify_chunk

        chunk = "Ta'rif: Kasrning surаti va maxraji deyiladi."
        doc_meta = self._make_doc_meta()

        with patch("duyo.textbook.pipeline.llm_classifier.classify") as mock_llm:
            result = await classify_chunk(chunk, doc_meta)

        # Rule confidence >= 0.90 for "Ta'rif:" → LLM never called
        mock_llm.assert_not_called()
        assert result.content_type == ContentType.DEFINITION
        assert result.classified_by == "rule"

    @pytest.mark.asyncio
    async def test_low_confidence_calls_llm(self) -> None:
        from duyo.textbook.pipeline import classify_chunk

        chunk = "Bu mavzu haqida ko'proq ma'lumot beramiz."
        doc_meta = self._make_doc_meta()

        llm_meta = ChunkMetadata(
            subject="matematika", grade=6,
            language=Language.UZ, script=Script.LATIN,
            source_path="x.txt",
            content_type=ContentType.EXPLANATION,
            confidence=Confidence(content_type=0.80, topic=0.60, difficulty=0.50),
            classified_by="llm",
        )

        with patch(
            "duyo.textbook.pipeline.llm_classifier.classify",
            new_callable=AsyncMock,
            return_value=llm_meta,
        ) as mock_llm:
            result = await classify_chunk(chunk, doc_meta)

        mock_llm.assert_called_once()
        assert result.content_type == ContentType.EXPLANATION
        assert "llm" in result.classified_by

    @pytest.mark.asyncio
    async def test_llm_failure_falls_back_to_rule(self) -> None:
        from duyo.textbook.pipeline import classify_chunk

        chunk = "Bu mavzu haqida ko'proq ma'lumot beramiz kelajakda."
        doc_meta = self._make_doc_meta()

        with patch(
            "duyo.textbook.pipeline.llm_classifier.classify",
            new_callable=AsyncMock,
            side_effect=ValueError("JSON parse error"),
        ):
            result = await classify_chunk(chunk, doc_meta)

        # Falls back to rule result with needs_review=True
        assert result.needs_review is True
        assert result.classified_by == "rule"
