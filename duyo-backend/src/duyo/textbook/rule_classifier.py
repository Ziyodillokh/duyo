"""Rule-based content_type classifier for Uzbek/Russian educational text.

Heuristics fire before the LLM to save cost.
Confidence >= 0.90 → skip LLM entirely.
Confidence 0.70-0.89 → pass to LLM as a hint.
Confidence < 0.70 → LLM classifies without a hint.

has_formula / has_table / has_image are also detected here from text signals
so the LLM prompt doesn't need to re-derive them.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from duyo.textbook.schema import ContentType

# ---------------------------------------------------------------------------
# Pattern registry
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class _Rule:
    pattern: re.Pattern[str]
    content_type: ContentType
    confidence: float


def _p(pattern: str) -> re.Pattern[str]:
    return re.compile(pattern, re.IGNORECASE | re.UNICODE)


_RULES: list[_Rule] = [
    # ── DEFINITION ──────────────────────────────────────────────────────────
    # Uzbek: "Ta'rif:", "deb ataladi", "— bu", "deyiladi"
    # Russian: "Определение:", "называется"
    _Rule(_p(r"ta['']rif\s*:"), ContentType.DEFINITION, 0.95),
    _Rule(_p(r"определение\s*:"), ContentType.DEFINITION, 0.95),
    _Rule(_p(r"\bdeb\s+ataladi\b"), ContentType.DEFINITION, 0.90),
    _Rule(_p(r"\bdeyiladi\b"), ContentType.DEFINITION, 0.85),
    _Rule(_p(r"\bнazывается\b|\bназывают\b"), ContentType.DEFINITION, 0.85),
    _Rule(_p(r"—\s*bu\b|–\s*bu\b"), ContentType.DEFINITION, 0.75),

    # ── RULE ────────────────────────────────────────────────────────────────
    # Uzbek: "Qoida:", "Qoidasi:", "kerak", "mumkin emas"
    # Russian: "Правило:", "Теорема:"
    _Rule(_p(r"qoida\s*:"), ContentType.RULE, 0.95),
    _Rule(_p(r"правило\s*:"), ContentType.RULE, 0.95),
    _Rule(_p(r"теорема\s*:"), ContentType.RULE, 0.90),
    _Rule(_p(r"teorema\s*:"), ContentType.RULE, 0.90),
    _Rule(_p(r"qonun\s*:"), ContentType.RULE, 0.88),
    _Rule(_p(r"закон\s*:"), ContentType.RULE, 0.88),
    _Rule(_p(r"eslatma\s*:"), ContentType.RULE, 0.75),
    _Rule(_p(r"diqqat\s*!"), ContentType.RULE, 0.72),

    # ── WORKED SOLUTION ─────────────────────────────────────────────────────
    # Multi-step, explicit "Yechish:", "Берилган:", "Топиш:"
    _Rule(_p(r"yechish\s*:"), ContentType.WORKED_SOLUTION, 0.95),
    _Rule(_p(r"решение\s*:"), ContentType.WORKED_SOLUTION, 0.95),
    _Rule(_p(r"берилган\s*:|berilgan\s*:"), ContentType.WORKED_SOLUTION, 0.88),
    _Rule(_p(r"topish\s*:|найти\s*:"), ContentType.WORKED_SOLUTION, 0.85),
    _Rule(_p(r"javob\s*:|ответ\s*:"), ContentType.WORKED_SOLUTION, 0.80),
    # "1-qadam", "2-qadam" pattern
    _Rule(_p(r"\d+[-–]\s*qadam\b"), ContentType.WORKED_SOLUTION, 0.85),
    _Rule(_p(r"\d+[-–]\s*шаг\b"), ContentType.WORKED_SOLUTION, 0.85),

    # ── EXERCISE ────────────────────────────────────────────────────────────
    # Uzbek: "Mashq:", "Misol:", "Hisoblang", "Toping", "Aniqlang"
    # Russian: "Упражнение:", "Вычислите:", "Найдите:"
    _Rule(_p(r"mashq\s*:|\bmashq\s+\d+|\bупражнение\s*:"), ContentType.EXERCISE, 0.95),
    _Rule(_p(r"\bhisoblang\b|\bвычислите\b"), ContentType.EXERCISE, 0.90),
    _Rule(_p(r"\btoping\b|\bнайдите\b"), ContentType.EXERCISE, 0.88),
    _Rule(_p(r"\baniqlang\b|\bопределите\b"), ContentType.EXERCISE, 0.85),
    _Rule(_p(r"\byeching\b|\bрешите\b"), ContentType.EXERCISE, 0.85),
    _Rule(_p(r"\byozing\b|\bзапишите\b"), ContentType.EXERCISE, 0.80),
    # Numbered list "1) ...\n2) ..." without explicit keyword
    _Rule(_p(r"^\s*\d+\)\s+\w"), ContentType.EXERCISE, 0.65),

    # ── QUIZ ────────────────────────────────────────────────────────────────
    # A) / B) / C) / D) variant pattern
    _Rule(_p(r"\bA\s*\)\s+\w.+\bB\s*\)\s+\w"), ContentType.QUIZ, 0.95),
    _Rule(_p(r"\bА\s*\)\s+\w.+\bБ\s*\)\s+\w"), ContentType.QUIZ, 0.95),  # Cyrillic
    _Rule(_p(r"test\s+savol|тест\s+вопрос"), ContentType.QUIZ, 0.90),

    # ── EXAMPLE ─────────────────────────────────────────────────────────────
    # Short "Masalan:" / "Например:" without full yechim
    _Rule(_p(r"masalan\s*:|например\s*:"), ContentType.EXAMPLE, 0.85),
    _Rule(_p(r"\d+[-–]misol\b|\bмисол\s*:"), ContentType.EXAMPLE, 0.82),
]


# ── Formula / table / image signals ─────────────────────────────────────────

# STRONG signals are reliable in ANY subject — LaTeX, named math functions,
# unicode super/subscripts, and unambiguous math operators (times, divide,
# root, integral, sigma, product). These rarely appear by accident in prose.
_STRONG_FORMULA_PATTERNS: list[re.Pattern[str]] = [
    _p(r"\$[^$]+\$|\\\(.+?\\\)"),       # LaTeX inline
    _p(r"\\frac|\\sqrt|\\sum|\\int"),   # LaTeX commands
    _p(r"[×÷√∫∑∏]"),                    # unambiguous math operators
    _p(r"\b[a-zA-Z]\s*[²³⁴]"),         # exponents  x²
    _p(r"[½⅓¼⅔¾⅕⅖]"),                   # unicode fractions
    _p(r"\b(?:sin|cos|tan|log|sqrt)\b"),  # math functions
]

# LOOSE signals fire ONLY for math-like subjects. In text subjects (ona-tili,
# tarix, biologiya) they collide with suffix lists ("-bon, -gi"), exercise
# numbering, and OCR noise, producing false has_formula=true.
_MATH_FORMULA_PATTERNS: list[re.Pattern[str]] = [
    _p(r"[=+\-*/^]{2,}"),             # dense ASCII operators
    _p(r"\d+\s*/\s*\d+"),             # fraction a/b
    _p(r"\b[a-zA-Z]\s*=\s*\d"),       # variable assignment  x = 5
    _p(r"\bfrac\b"),                  # bare "frac"
]

# Subjects where loose numeric patterns indicate real formulas.
_MATH_SUBJECTS = frozenset({
    "matematika", "algebra", "geometriya", "fizika", "kimyo",
})


def _detect_formula(text: str, subject: str | None) -> bool:
    """Detect formulas; loose numeric patterns only for math-like subjects."""
    if any(p.search(text) for p in _STRONG_FORMULA_PATTERNS):
        return True
    if subject and subject.lower() in _MATH_SUBJECTS:
        return any(p.search(text) for p in _MATH_FORMULA_PATTERNS)
    return False

_TABLE_PATTERNS: list[re.Pattern[str]] = [
    _p(r"\|.+\|"),                    # markdown table row
    _p(r"\t.+\t"),                    # tab-separated columns
    _p(r"─{3,}|━{3,}|[-]{3,}"),      # table border lines
]

_IMAGE_PATTERNS: list[re.Pattern[str]] = [
    _p(r"\[rasm\]|\[shakl\]|\[chizma\]"),   # Uzbek image placeholders
    _p(r"\[рисунок\]|\[чертёж\]"),          # Russian image placeholders
    _p(r"!\[.*?\]\(.*?\)"),                  # Markdown image
]


# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------

@dataclass
class RuleResult:
    content_type: ContentType
    confidence: float
    has_formula: bool
    has_table: bool
    has_image: bool
    matched_rules: list[str] = field(default_factory=list)


def classify(text: str, subject: str | None = None) -> RuleResult:
    """Apply all rules and return the highest-confidence content_type match.

    Ties are broken by the order rules appear (earlier = higher priority).
    Falls back to EXPLANATION at confidence 0.40 when nothing matches.

    `subject` gates loose numeric formula patterns: in text subjects they
    collide with exercise numbering and suffix lists, so they only fire for
    math-like subjects.
    """
    best_type = ContentType.EXPLANATION
    best_conf = 0.40
    matched: list[str] = []

    for rule in _RULES:
        if rule.pattern.search(text):
            matched.append(f"{rule.content_type}@{rule.confidence:.2f}")
            if rule.confidence > best_conf:
                best_conf = rule.confidence
                best_type = rule.content_type

    # Special case: if both WORKED_SOLUTION and EXERCISE signals fire,
    # prefer WORKED_SOLUTION when "Yechish/Javob" also present.
    if (
        best_type == ContentType.EXERCISE
        and any(
            p.search(text)
            for p in [_p(r"yechish\s*:"), _p(r"javob\s*:"), _p(r"решение\s*:")]
        )
    ):
        best_type = ContentType.WORKED_SOLUTION
        best_conf = min(best_conf + 0.05, 0.95)

    has_formula = _detect_formula(text, subject)
    has_table = any(p.search(text) for p in _TABLE_PATTERNS)
    has_image = any(p.search(text) for p in _IMAGE_PATTERNS)

    return RuleResult(
        content_type=best_type,
        confidence=best_conf,
        has_formula=has_formula,
        has_table=has_table,
        has_image=has_image,
        matched_rules=matched,
    )
