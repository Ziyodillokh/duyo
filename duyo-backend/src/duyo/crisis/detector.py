"""Crisis Detection Layer 1 — keyword + pattern matcher.

Per TZ §9.2 / §10.2 — this is the first of 4 layers. It runs synchronously
BEFORE the message is sent to the LLM, with a target latency of <100ms.

Design choices:

- Returns ALL matches (not just the first) so the higher-layer classifier
  has full context.
- Normalises text but preserves the original for audit logging.
- Defaults to `safe` when no signal is found — this layer is intentionally
  conservative and only flags clear textual evidence. Subtle patterns are
  Layer 3's job.
- Never raises on user input. A buggy detector that crashes would silently
  send unsafe content downstream, which is the exact failure mode we exist
  to prevent.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from enum import Enum

from duyo.crisis.keywords import (
    KEYWORDS_BY_CATEGORY,
    CrisisCategory,
    Language,
)


class CrisisLevel(str, Enum):
    """Risk level per TZ §9.4."""

    GREEN = "GREEN"      # normal
    YELLOW = "YELLOW"    # passive negative signals
    ORANGE = "ORANGE"    # self-harm / abuse signals → parent SMS within 24h
    RED = "RED"          # clear imminent risk → immediate SMS + call


# Mapping from category to the level Layer 1 raises when a direct keyword hits.
# Per TZ §9.4, abuse victim does NOT auto-escalate to parent alert.
_CATEGORY_LEVEL: dict[CrisisCategory, CrisisLevel] = {
    CrisisCategory.SUICIDAL: CrisisLevel.RED,
    CrisisCategory.SELF_HARM: CrisisLevel.ORANGE,
    CrisisCategory.VIOLENCE: CrisisLevel.RED,
    CrisisCategory.ABUSE_VICTIM: CrisisLevel.ORANGE,
    CrisisCategory.NEGLECT: CrisisLevel.ORANGE,
    CrisisCategory.BULLYING: CrisisLevel.ORANGE,
    CrisisCategory.EATING_DISORDER: CrisisLevel.YELLOW,
    CrisisCategory.SUBSTANCE_ABUSE: CrisisLevel.ORANGE,
}


@dataclass(frozen=True)
class CrisisMatch:
    """One keyword hit. Multiple hits per message are possible."""

    keyword: str
    category: CrisisCategory
    language: Language


@dataclass(frozen=True)
class CrisisResult:
    """Output of Layer 1 detection. Immutable so it can be safely logged."""

    level: CrisisLevel
    matches: tuple[CrisisMatch, ...] = field(default_factory=tuple)

    @property
    def is_safe(self) -> bool:
        return self.level == CrisisLevel.GREEN

    @property
    def categories(self) -> frozenset[CrisisCategory]:
        return frozenset(m.category for m in self.matches)


_FILLER_ADVERBS = re.compile(
    r"\b("
    # Uzbek frequency/time adverbs that break subject-verb proximity
    r"har\s+kuni|har\s+doim|har\s+vaqt|doimo|doim|tez[-\s]tez|"
    r"kecha|bugun|ertaga|hozir|ko'p\s+marta|kop\s+marta|hamma\s+vaqt|hamisha|"
    # Russian
    r"вчера|сегодня|каждый\s+день|часто|всегда|постоянно|"
    # English
    r"every\s+day|yesterday|today|often|always|all\s+the\s+time|every\s+time"
    r")\b"
)


def _normalize(text: str) -> str:
    """Lowercase, normalise apostrophes, strip filler adverbs, collapse whitespace.

    Filler adverbs (`har kuni`, `вчера`, `every day`) are stripped so that
    keyword phrases like `meni uradi` still match `otam meni har kuni uradi`.
    Without this, the substring search misses any victim phrase with a
    frequency/time modifier between subject and verb — exactly the most
    common way children describe ongoing abuse.
    """
    text = text.lower().strip()
    # Replace curly/typographic apostrophes with straight ones.
    text = text.replace("’", "'").replace("‘", "'").replace("`", "'")
    # NFKC normalise (combines accented chars), keep apostrophes intact.
    text = unicodedata.normalize("NFKC", text)
    # Strip filler adverbs and collapse whitespace.
    text = _FILLER_ADVERBS.sub(" ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


class KeywordCrisisDetector:
    """Layer 1 keyword detector.

    Thread-safe and stateless after construction. Build once at app startup
    and share across requests.
    """

    def __init__(self) -> None:
        # Pre-compile a tuple of (pattern, keyword, category, language) for fast
        # iteration. We use substring match — these phrases are intentionally
        # long enough to avoid false positives from substrings.
        self._entries: tuple[tuple[str, CrisisCategory, Language], ...] = tuple(
            (_normalize(kw), category, lang)
            for category, by_lang in KEYWORDS_BY_CATEGORY.items()
            for lang, keywords in by_lang.items()
            for kw in keywords
        )

    def check(self, text: str) -> CrisisResult:
        """Scan `text` for keyword matches and return a CrisisResult.

        Returns GREEN when no keyword matches. Otherwise level is the highest
        priority among all matched categories.
        """
        if not text or not text.strip():
            return CrisisResult(level=CrisisLevel.GREEN)

        normalized = _normalize(text)
        matches: list[CrisisMatch] = []

        for kw, category, lang in self._entries:
            if kw in normalized:
                matches.append(CrisisMatch(keyword=kw, category=category, language=lang))

        if not matches:
            return CrisisResult(level=CrisisLevel.GREEN)

        # Pick the most severe level across all matched categories.
        level = _highest_level(_CATEGORY_LEVEL[m.category] for m in matches)
        return CrisisResult(level=level, matches=tuple(matches))


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_LEVEL_PRIORITY: dict[CrisisLevel, int] = {
    CrisisLevel.GREEN: 0,
    CrisisLevel.YELLOW: 1,
    CrisisLevel.ORANGE: 2,
    CrisisLevel.RED: 3,
}


def _highest_level(levels: Iterable[CrisisLevel]) -> CrisisLevel:
    return max(levels, key=lambda lvl: _LEVEL_PRIORITY[lvl])


# Re-export at module level for ergonomic imports.
from collections.abc import Iterable  # noqa: E402  (used by type-string above)
