"""Unit tests for rule_classifier — no LLM, no DB, pure logic."""

import pytest

from duyo.textbook.rule_classifier import classify
from duyo.textbook.schema import ContentType


# ---------------------------------------------------------------------------
# Definition patterns
# ---------------------------------------------------------------------------

class TestDefinition:
    def test_tarf_prefix(self) -> None:
        result = classify("Ta'rif: Kasrning surати deyiladi.")
        assert result.content_type == ContentType.DEFINITION
        assert result.confidence >= 0.90

    def test_deb_ataladi(self) -> None:
        result = classify("Bu son natural son deb ataladi.")
        assert result.content_type == ContentType.DEFINITION
        assert result.confidence >= 0.88

    def test_russian_opredelenie(self) -> None:
        result = classify("Определение: Дробью называется...")
        assert result.content_type == ContentType.DEFINITION
        assert result.confidence >= 0.90

    def test_deyiladi(self) -> None:
        result = classify("Ushbu ifoda algebraik ifoda deyiladi.")
        assert result.content_type == ContentType.DEFINITION
        assert result.confidence >= 0.80


# ---------------------------------------------------------------------------
# Rule patterns
# ---------------------------------------------------------------------------

class TestRule:
    def test_qoida_prefix(self) -> None:
        result = classify("Qoida: Bir xil maxrajli kasrlarni qo'shishda suratlari qo'shiladi.")
        assert result.content_type == ContentType.RULE
        assert result.confidence >= 0.90

    def test_teorema(self) -> None:
        result = classify("Teorema: To'g'ri burchakli uchburchakda katetlar kvadratlari yig'indisi...")
        assert result.content_type == ContentType.RULE
        assert result.confidence >= 0.88

    def test_russian_pravilo(self) -> None:
        result = classify("Правило: При сложении дробей с одинаковыми знаменателями...")
        assert result.content_type == ContentType.RULE
        assert result.confidence >= 0.90


# ---------------------------------------------------------------------------
# Exercise patterns
# ---------------------------------------------------------------------------

class TestExercise:
    def test_hisoblang(self) -> None:
        result = classify("Hisoblang: 3/4 + 1/4 = ?")
        assert result.content_type == ContentType.EXERCISE
        assert result.confidence >= 0.85

    def test_mashq_prefix(self) -> None:
        result = classify("Mashq 15. Quyidagilarni bajaring:\na) 5 + 3\nb) 7 - 2")
        assert result.content_type == ContentType.EXERCISE
        assert result.confidence >= 0.90

    def test_toping(self) -> None:
        result = classify("Toping: x ning qiymatini aniqlang, agar 2x + 3 = 11.")
        assert result.content_type == ContentType.EXERCISE
        assert result.confidence >= 0.85

    def test_russian_vychislite(self) -> None:
        result = classify("Вычислите: 45 × 12 + 30.")
        assert result.content_type == ContentType.EXERCISE
        assert result.confidence >= 0.88


# ---------------------------------------------------------------------------
# Worked solution patterns
# ---------------------------------------------------------------------------

class TestWorkedSolution:
    def test_yechish_prefix(self) -> None:
        text = "Yechish: Birinchi qadam — maxrajlarni tenglashtiramiz.\nJavob: 7/12"
        result = classify(text)
        assert result.content_type == ContentType.WORKED_SOLUTION
        assert result.confidence >= 0.90

    def test_qadam_pattern(self) -> None:
        text = "1-qadam: Suratlari qo'shiladi.\n2-qadam: Natijani soddalashtiring."
        result = classify(text)
        assert result.content_type == ContentType.WORKED_SOLUTION
        assert result.confidence >= 0.80

    def test_berilgan_topish(self) -> None:
        text = "Berilgan: a = 5, b = 3.\nTopish: a + b = ?"
        result = classify(text)
        assert result.content_type == ContentType.WORKED_SOLUTION
        assert result.confidence >= 0.80


# ---------------------------------------------------------------------------
# Quiz patterns
# ---------------------------------------------------------------------------

class TestQuiz:
    def test_abcd_variants(self) -> None:
        text = "Qaysi javob to'g'ri?\nA) 5   B) 7   C) 3   D) 9"
        result = classify(text)
        assert result.content_type == ContentType.QUIZ
        assert result.confidence >= 0.90


# ---------------------------------------------------------------------------
# Formula / table / image detection
# ---------------------------------------------------------------------------

class TestStructuralDetection:
    def test_detects_formula_fraction(self) -> None:
        result = classify("3/4 + 5/6 ni hisoblang.")
        assert result.has_formula is True

    def test_detects_formula_operators(self) -> None:
        result = classify("a² + b² = c² formulasi yordamida toping.")
        assert result.has_formula is True

    def test_detects_table_markdown(self) -> None:
        result = classify("| Son | Kvadrat |\n| 2 | 4 |\n| 3 | 9 |")
        assert result.has_table is True

    def test_detects_image_placeholder_uz(self) -> None:
        result = classify("[rasm] Quyidagi shaklga qarang.")
        assert result.has_image is True

    def test_no_formula_plain_text(self) -> None:
        result = classify("Bu darsda o'simliklar haqida o'rganamiz.")
        assert result.has_formula is False
        assert result.has_table is False
        assert result.has_image is False


# ---------------------------------------------------------------------------
# Fallback behaviour
# ---------------------------------------------------------------------------

class TestFallback:
    def test_plain_explanation_low_confidence(self) -> None:
        result = classify("Kasrlar haqida qo'shimcha ma'lumot beramiz. Ular juda foydali.")
        assert result.content_type == ContentType.EXPLANATION
        assert result.confidence < 0.70

    def test_empty_text_defaults(self) -> None:
        result = classify("   ")
        assert result.content_type == ContentType.EXPLANATION
        assert result.confidence < 0.70
