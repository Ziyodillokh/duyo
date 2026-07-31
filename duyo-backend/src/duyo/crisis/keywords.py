"""Crisis keyword lists in 3 languages — based on TZ §9.3 and §10.2.

CRITICAL: This list must be reviewed by pediatric psychologists before production.
The current set is a baseline derived from the spec. Expanding it requires
clinical sign-off because every entry directly affects child safety alerting.
NEGLECT/BULLYING/EATING_DISORDER/SUBSTANCE_ABUSE are a draft first pass and
carry the same requirement — do not ship without clinical review.

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
    NEGLECT = "neglect"          # child reporting being left unfed/unsupervised/uncared for
    BULLYING = "bullying"        # child reporting being bullied/excluded by peers
    EATING_DISORDER = "eating_disorder"  # restrictive eating, purging, body-image distress
    SUBSTANCE_ABUSE = "substance_abuse"  # child mentions using alcohol/drugs


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


# ---------------------------------------------------------------------------
# Neglect — child reporting being left unfed/unsupervised/uncared for.
# Handled like ABUSE_VICTIM: no auto-parent alert (the parent may be the
# neglect source), routed to human safety review instead. Per TZ §9.6 analogy.
# ---------------------------------------------------------------------------

NEGLECT_KEYWORDS: dict[Language, tuple[str, ...]] = {
    Language.UZ: (
        "uyda hech kim yo'q",
        "uyda hech kim yoq",
        "meni yolg'iz tashlab",
        "meni yolgiz tashlab",
        "ovqat bermaydi",
        "ovqat bermaydilar",
        "kunlab ovqatlanmadim",
        "hech kim g'amxo'rlik qilmaydi",
        "hech kim gamxorlik qilmaydi",
        "meni unutib qo'yishdi",
        "meni unutib qoyishdi",
    ),
    Language.RU: (
        "дома никого нет",
        "меня бросили одного",
        "меня не кормят",
        "никто не заботится обо мне",
    ),
    Language.EN: (
        "no one is home",
        "left me alone for days",
        "they don't feed me",
        "nobody takes care of me",
    ),
}


# ---------------------------------------------------------------------------
# Bullying — child reporting being bullied/excluded by peers. Unlike abuse by
# a caregiver, the parent is a normal ally here, so this DOES auto-notify.
# ---------------------------------------------------------------------------

BULLYING_KEYWORDS: dict[Language, tuple[str, ...]] = {
    Language.UZ: (
        "meni maktabda masxara qilishadi",
        "meni masxara qiladi",
        "meni ustimdan kulishadi",
        "meni hech kim bilan o'ynashmaydi",
        "meni hech kim bilan oynashmaydi",
        "meni do'stlarim rad etishdi",
        "meni dostlarim rad etishdi",
        "meni maktabda kaltaklashadi",
        "meni bulling qilishadi",
        "meni haqoratlashadi",
    ),
    Language.RU: (
        "надо мной издеваются в школе",
        "меня травят",
        "меня никто не берёт играть",
        "надо мной смеются все",
    ),
    Language.EN: (
        "they bully me at school",
        "everyone makes fun of me",
        "no one lets me play with them",
        "i get bullied every day",
    ),
}


# ---------------------------------------------------------------------------
# Eating disorder — restrictive eating, purging, body-image distress signals.
# ---------------------------------------------------------------------------

EATING_DISORDER_KEYWORDS: dict[Language, tuple[str, ...]] = {
    Language.UZ: (
        "ovqat yemayman",
        "ovqatlanishni to'xtatdim",
        "ovqatlanishni toxtatdim",
        "o'zimni juda semiz his qilaman",
        "ozimni juda semiz his qilaman",
        "qusib tashlayman",
        "ovqatdan keyin qusaman",
        "hech narsa yemaslikka harakat qilaman",
    ),
    Language.RU: (
        "не ем уже несколько дней",
        "вызываю рвоту после еды",
        "чувствую себя слишком толстой",
        "чувствую себя слишком толстым",
    ),
    Language.EN: (
        "i stopped eating",
        "i make myself throw up",
        "i feel too fat",
        "i haven't eaten in days",
    ),
}


# ---------------------------------------------------------------------------
# Substance abuse — child mentions using alcohol/drugs.
# ---------------------------------------------------------------------------

SUBSTANCE_ABUSE_KEYWORDS: dict[Language, tuple[str, ...]] = {
    Language.UZ: (
        "spirtli ichimlik ichdim",
        "aroq ichdim",
        "giyohvand modda ishlatdim",
        "narkotik ichdim",
        "sigareta chekaman",
        "dorini ko'p ichdim",
        "dorini kop ichdim",
    ),
    Language.RU: (
        "я выпил алкоголь",
        "я употребляю наркотики",
        "я курю",
        "выпила таблетки",
    ),
    Language.EN: (
        "i drank alcohol",
        "i took drugs",
        "i smoke cigarettes",
        "i took too many pills",
    ),
}


# Master lookup table grouped by category.
KEYWORDS_BY_CATEGORY: dict[CrisisCategory, dict[Language, tuple[str, ...]]] = {
    CrisisCategory.SUICIDAL: SUICIDAL_KEYWORDS,
    CrisisCategory.SELF_HARM: SELF_HARM_KEYWORDS,
    CrisisCategory.VIOLENCE: VIOLENCE_KEYWORDS,
    CrisisCategory.ABUSE_VICTIM: ABUSE_VICTIM_KEYWORDS,
    CrisisCategory.NEGLECT: NEGLECT_KEYWORDS,
    CrisisCategory.BULLYING: BULLYING_KEYWORDS,
    CrisisCategory.EATING_DISORDER: EATING_DISORDER_KEYWORDS,
    CrisisCategory.SUBSTANCE_ABUSE: SUBSTANCE_ABUSE_KEYWORDS,
}
