"""Crisis keyword lists in 3 languages — based on TZ §9.3 and §10.2.

CRITICAL: This list must be reviewed by pediatric psychologists before production.
The current set is a baseline derived from the spec. Expanding it requires
clinical sign-off because every entry directly affects child safety alerting.

Reference: https://www.who.int/health-topics/suicide  (warning signs)
"""

from __future__ import annotations

from enum import Enum


class Language(str, Enum):
    UZ = "uz"
    RU = "ru"
    EN = "en"


class CrisisCategory(str, Enum):
    """Category of detected risk."""

    SUICIDAL = "suicidal"        # self-directed lethal intent
    SELF_HARM = "self_harm"      # cutting, harming without explicit lethal intent
    VIOLENCE = "violence"        # intent to harm others
    ABUSE_VICTIM = "abuse_victim"  # child reporting being abused


# ---------------------------------------------------------------------------
# Suicidal ideation — highest severity. Per TZ §9.3.
# ---------------------------------------------------------------------------

SUICIDAL_KEYWORDS: dict[Language, tuple[str, ...]] = {
    Language.UZ: (
        "o'zimni o'ldiraman",
        "ozimni oldiraman",
        "o'zimni o'ldirmoqchiman",
        "ozimni oldirmoqchiman",
        "o'zimni o'ldirib",
        "ozimni oldirib",
        "yashashni xohlamayman",
        "yashagim kelmaydi",
        "hech kimga keragim yo'q",
        "hech kimga keragim yoq",
        "balandga chiqaman",
        "tabletka ichaman",
        "kesaman o'zimni",
        "kesaman ozimni",
        "yo'qolib ketmoqchiman",
        "yoqolib ketmoqchiman",
        "hech qachon bunday og'ir bo'lmagan",
        "yashashdan charchadim",
        "hayotim manosiz",
        "hayotim ma'nosiz",
        "men o'lsam",
        "men olsam",
        "o'lib qo'ya qolay",
        "olib qoya qolay",
    ),
    Language.RU: (
        "хочу умереть",
        "не хочу жить",
        "никому не нужен",
        "никому не нужна",
        "покончить с собой",
        "убить себя",
        "выпрыгнуть",
        "нет смысла жить",
        "лучше бы я умер",
        "лучше бы я умерла",
        "устал жить",
        "устала жить",
    ),
    Language.EN: (
        "kill myself",
        "want to die",
        "end it all",
        "suicide",
        "no reason to live",
        "better off dead",
        "tired of living",
        "ending my life",
        "take my own life",
    ),
}


# ---------------------------------------------------------------------------
# Self-harm (non-lethal cutting, burning, etc.)
# ---------------------------------------------------------------------------

SELF_HARM_KEYWORDS: dict[Language, tuple[str, ...]] = {
    Language.UZ: (
        "o'zimni kesaman",
        "ozimni kesaman",
        "o'zimga zarar",
        "ozimga zarar",
        "o'zimga zarar yetkazaman",
        "ozimga zarar yetkazaman",
        "tanamga zarar",
        "qo'limni kesaman",
        "qolimni kesaman",
        "qonatib",
    ),
    Language.RU: (
        "порезать",
        "режу себя",
        "порезы",
        "сделать себе больно",
    ),
    Language.EN: (
        "cut myself",
        "cutting myself",
        "hurt myself",
        "self harm",
        "self-harm",
    ),
}


# ---------------------------------------------------------------------------
# Violence toward others
# ---------------------------------------------------------------------------

VIOLENCE_KEYWORDS: dict[Language, tuple[str, ...]] = {
    Language.UZ: (
        "o'ldirgim keladi",
        "oldirgim keladi",
        "pichoq olib boraman",
        "pichoq olib chiqaman",
        "hammasini o'ldiraman",
        "hammasini oldiraman",
    ),
    Language.RU: (
        "хочу убить",
        "принесу нож",
        "всех убью",
    ),
    Language.EN: (
        "want to kill",
        "bring a knife",
        "shoot up the school",
        "hurt them all",
    ),
}


# ---------------------------------------------------------------------------
# Abuse victim signals — handled DIFFERENTLY (no auto-parent alert).
# Per TZ §10.6 / §9.6.
# ---------------------------------------------------------------------------

ABUSE_VICTIM_KEYWORDS: dict[Language, tuple[str, ...]] = {
    # Soft / partial patterns — substring match, so "har kuni" / "doim" inserts
    # between subject and verb still hit because we match on "meni uradi", "meni urdi",
    # etc. as standalone phrases. High recall on purpose — Layer 2 (Gemini) tunes precision.
    Language.UZ: (
        # Direct subject patterns (legacy)
        "otam meni uradi",
        "amaki noto'g'ri",
        "amaki notogri",
        "maktabda meni urishadi",
        "hech kimga aytma",
        "ustozim urdi",
        # Generic "hit/beat me" patterns — catch when "har kuni"/"doim" splits subject and verb
        "meni uradi",
        "meni urdi",
        "meni urgan",
        "meni urishadi",
        "meni urishdi",
        "meni urib",
        "meni kaltaklaydi",
        "meni kaltakladi",
        "meni kaltaklab",
        "meni mushtlaydi",
        "meni qiynaydi",
        "meni qiynaydilar",
        "meni jismoniy",
        # Witnessed body marks (often paired with abuse)
        "yuzimga urdi",
        "ko'kargan",
        "kokargan",
        # Inappropriate touching (children's phrasing varies)
        "noto'g'ri tegdi",
        "notogri tegdi",
        "yopiq joyimga",
    ),
    Language.RU: (
        "папа меня бьёт",
        "папа меня бьет",
        "дядя трогает",
        "учитель ударил",
        "никому не говори",
        "меня бьют",
        "меня бьёт",
        "меня бьет",
        "меня избили",
        "меня поколотили",
        "меня ударил",
        "меня ударили",
        "трогает меня",
    ),
    Language.EN: (
        "my dad hits me",
        "my uncle touches",
        "teacher hit me",
        "don't tell anyone",
        "dont tell anyone",
        "they hit me",
        "they beat me",
        "beat me up",
        "i was hit",
        "i got hit",
        "touches me",
        "touched me there",
    ),
}


# Master lookup table grouped by category.
KEYWORDS_BY_CATEGORY: dict[CrisisCategory, dict[Language, tuple[str, ...]]] = {
    CrisisCategory.SUICIDAL: SUICIDAL_KEYWORDS,
    CrisisCategory.SELF_HARM: SELF_HARM_KEYWORDS,
    CrisisCategory.VIOLENCE: VIOLENCE_KEYWORDS,
    CrisisCategory.ABUSE_VICTIM: ABUSE_VICTIM_KEYWORDS,
}
