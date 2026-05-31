"""Reusable chunk-quality filter for the textbook ingestion pipeline.

Drops genuine non-content noise before classification and the vector store —
front-matter (cover/title/copyright pages), table-of-contents dotted-leader
lines, table/jadval dumps, and OCR gibberish (symbol soup, repetitive loops).

Applies to ANY book and ANY OCR engine (Docling / Tesseract / MinerU), so the
same rules clean every textbook ingested now and in the future.

Design principle: HIGH PRECISION over recall. Short does NOT mean garbage — a
real historical fact ("Mil. avv. I asr da Xorazmda mahalliy taqvim ishlab
chiqilgan.") must survive. A real paragraph that merely *contains* a dotted
leader or an OCR-noise tail is kept; only chunks that are *dominated* by noise
are dropped. When in doubt, keep. Every signal is unit-tested against real
grade-6 OCR samples — both drop-cases and keep-cases.
"""

from __future__ import annotations

import re
from collections import Counter

# Below this length a chunk cannot carry a useful idea (e.g. a stray "BOB II").
# The pipeline already enforces a 60-char minimum upstream; this is a backstop.
_MIN_CONTENT_CHARS = 20

# Front-matter boilerplate (cover, title, copyright, publisher). These phrases
# live on the first/last pages of textbooks and never inside lesson bodies.
# Only disqualifying for short-ish chunks (a real lesson may mention "nashr").
_BOILERPLATE_MAX_CHARS = 600
_BOILERPLATE_PATTERNS = [
    re.compile(r"\bISBN\b"),
    re.compile(r"\bNMIU\b"),
    re.compile(r"\bUO['ʻ]?K\b|\bKBK\b"),                       # catalogue codes
    re.compile(r"xalq\s+ta['ʻ’]?limi\s+vazirligi", re.IGNORECASE),
    re.compile(r"darslik\s+sifatida\s+tasdiqlagan", re.IGNORECASE),
    re.compile(r"tomonidan\s+tavsiya\s+etilgan", re.IGNORECASE),
    re.compile(r"qayta\s+ishlangan\s+va\s+to['ʻ’]?ldirilgan", re.IGNORECASE),
    re.compile(r"respublika\s+maqsadli\s+kitob", re.IGNORECASE),
    re.compile(r"mualliflik\s+huquqi|©", re.IGNORECASE),
    re.compile(r"elektron\s+ilova", re.IGNORECASE),
]

# Table-of-contents leaders: dotted/space runs connecting a title to a page
# number ("Mustahkamlash .......... 68"). 4+ dots is the signature.
_TOC_LEADER_RE = re.compile(r"\.{4,}|…{2,}")

# Glyphs that never occur in correct Uzbek Latin/Cyrillic — a reliable OCR-junk
# tell ("Mactßaba Üanpgo"). Narrow on purpose: stray Cyrillic in Latin text is
# NOT flagged here, since real bilingual lines and OCR'd verse carry a few.
_FOREIGN_JUNK_RE = re.compile(r"[ßþøæ¶Ü]")

# Figure placeholders ("[RASM]", "3- rasm.") are stripped before token analysis
# so a real caption is judged on its words, not the placeholder.
_PLACEHOLDER_RE = re.compile(
    r"\[(?:rasm|shakl|chizma|рисунок|чертёж)\]|\b\d+\s*[-–]?\s*rasm\.?",
    re.IGNORECASE,
)
_VOWEL_RE = re.compile(r"[aeiouioʻ'’аеёиоуыэюя]", re.IGNORECASE)

# Token = whitespace-separated run.
_TOKEN_RE = re.compile(r"\S+")
# Strip surrounding punctuation so "okeanlar." / "Afrika," count as words.
_PUNCT_STRIP_RE = re.compile(r"^[^\wЀ-ӿ]+|[^\wЀ-ӿ]+$")
_WORD_CORE_RE = re.compile(r"^[a-zA-ZЀ-ӿ'ʻ‘’\-]+$")


def _core(token: str) -> str:
    return _PUNCT_STRIP_RE.sub("", token)


def _distinct_alpha(core: str) -> int:
    return len({c.lower() for c in core if c.isalpha()})


def _is_real_word(token: str) -> bool:
    """A meaningful word: >=3 chars, alphabetic, has a vowel, and >=2 distinct
    letters (so OCR debris like 'U-U-U-U' or 'aaaa' is not counted as a word)."""
    core = _core(token)
    return (
        len(core) >= 3
        and bool(_WORD_CORE_RE.match(core))
        and bool(_VOWEL_RE.search(core))
        and _distinct_alpha(core) >= 2
    )


def _is_junk_token(token: str) -> bool:
    """A token carrying no meaning: empty, pure number, single char, vowel-less
    fragment, or a single repeated letter ('UUUU', 'U-U-U')."""
    core = _core(token)
    if not core or core.isdigit() or len(core) == 1:
        return True
    if _WORD_CORE_RE.match(core) and not _VOWEL_RE.search(core):
        return True
    return _distinct_alpha(core) <= 1


# A run of this many consecutive real words is unmistakably prose — the chunk
# carries real content and is kept even with a dotted/OCR-noise tail.
_COHERENT_PHRASE_LEN = 5


def _has_coherent_phrase(text: str) -> bool:
    """True if the text has a run of >=_COHERENT_PHRASE_LEN consecutive real
    words — genuine prose (a sentence or verse line) that must be kept."""
    run = 0
    for tok in _TOKEN_RE.findall(_PLACEHOLDER_RE.sub(" ", text)):
        if _is_real_word(tok):
            run += 1
            if run >= _COHERENT_PHRASE_LEN:
                return True
        else:
            run = 0
    return False


def _is_boilerplate(text: str) -> bool:
    if len(text) >= _BOILERPLATE_MAX_CHARS:
        return False
    return any(p.search(text) for p in _BOILERPLATE_PATTERNS)


def _is_toc(text: str) -> bool:
    """Table-of-contents chunk: dominated by dotted leaders, not prose."""
    return bool(_TOC_LEADER_RE.search(text))


# Symbol/fragment soup (chart axes, figure-label debris). Only for shortish
# chunks — a long paragraph with a noisy tail is real content and is kept.
_SOUP_MAX_CHARS = 400
_MAX_JUNK_RATIO = 0.45


def _is_symbol_soup(text: str) -> bool:
    if len(text) >= _SOUP_MAX_CHARS:
        return False
    tokens = _TOKEN_RE.findall(_PLACEHOLDER_RE.sub(" ", text))
    if len(tokens) < 8:
        return False
    junk = sum(1 for t in tokens if _is_junk_token(t))
    return junk / len(tokens) > _MAX_JUNK_RATIO


def _is_repetitive(text: str) -> bool:
    """One token dominating the chunk = looping OCR or a table dump where the
    '|' separator repeats ('| T/r | ... | ... |')."""
    tokens = [t.lower() for t in _TOKEN_RE.findall(text)]
    if len(tokens) < 6:
        return False
    _, count = Counter(tokens).most_common(1)[0]
    return count / len(tokens) >= 0.40


def is_low_quality(text: str) -> bool:
    """Return True if the chunk is non-content noise and should be dropped.

    Two tiers of signals:
      Structural noise (boilerplate, repeated table/loop) — always disqualifying.
      Layout/OCR noise (TOC leaders, symbol soup) — disqualifying ONLY when the
      chunk lacks a coherent prose run, so a real paragraph that merely contains
      a dotted tail or noise fragment is kept.
    """
    stripped = text.strip()
    if len(stripped) < _MIN_CONTENT_CHARS:
        return True
    # Tier 1 — structural noise, applies regardless of any prose present.
    if _is_boilerplate(stripped):
        return True
    if _is_repetitive(stripped):
        return True
    # Tier 2 — layout/OCR noise, overridden by genuine prose.
    if _has_coherent_phrase(stripped):
        return False
    if _is_toc(stripped):
        return True
    if _FOREIGN_JUNK_RE.search(stripped):
        return True
    return _is_symbol_soup(stripped)
