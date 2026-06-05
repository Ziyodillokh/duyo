"""Scripted (canned) responses for high-frequency intents (Concept §5 — "80%
scripted / 20% AI" cost optimization).

Code-defined catalogue (like levels/achievements): common greetings/thanks are
answered instantly without an LLM call. Matching is CONSERVATIVE — only when the
whole normalized message equals a known trigger — so real questions
("salom, matematika tushuntir") still reach the LLM. MVP: Uzbek only; other
languages fall through.
"""

from __future__ import annotations

import re

_PUNCT = re.compile(r"[^\w\s']", flags=re.UNICODE)


def _normalize(text: str) -> str:
    t = _PUNCT.sub("", text.strip().lower())
    return re.sub(r"\s+", " ", t).strip()


# (trigger phrases, response)
_INTENTS: list[tuple[set[str], str]] = [
    (
        {"salom", "assalomu alaykum", "assalom", "salom duyo", "hayrli kun", "hello"},
        "Salom! Men DUYO. Bugun nima qilamiz? 😊",
    ),
    (
        {"xayr", "ko'rishguncha", "xayr duyo", "salomat bo'l"},
        "Xayr! Yana suhbatlashamiz, o'zingni ehtiyot qil! 👋",
    ),
    (
        {"rahmat", "rahmat duyo", "tashakkur", "katta rahmat", "rahmat senga"},
        "Arzimaydi! Yordam berishdan doim xursandman. 💛",
    ),
    (
        {"qalaysan", "yaxshimisan", "ahvoling qanday", "qalaysiz", "yaxshimisiz"},
        "Men zo'rman, rahmat! Sen-chi, kayfiyating qanday? 😊",
    ),
    (
        {"sen kimsan", "kimsan", "isming nima", "sening isming nima"},
        "Men DUYO — sening do'sting va o'rganishda yordamchingman! 🌟",
    ),
]

_LOOKUP: dict[str, str] = {
    _normalize(trigger): resp for triggers, resp in _INTENTS for trigger in triggers
}


def match_scripted(message: str, language: str = "uz") -> str | None:
    """Canned response if the whole message is a known intent, else None.

    Uzbek only (MVP) — other languages return None so the LLM handles them.
    """
    if language != "uz":
        return None
    return _LOOKUP.get(_normalize(message))
