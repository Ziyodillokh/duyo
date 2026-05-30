"""Uzbek K-9 curriculum topic taxonomy.

topic_id format: {subject_short}_{grade}_{area}_{subtopic}
Example: math_6_fractions_add_same_denom

This is a manually curated seed taxonomy. Expand as content is ingested.
LLM normalizer outputs a topic string; taxonomy matcher finds the best topic_id.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class TopicEntry:
    canonical: str                   # official Uzbek name displayed to users
    aliases: tuple[str, ...]         # lowercase variants for fuzzy matching
    subject: str
    grade: int
    area: str                        # broad curriculum area


# ---------------------------------------------------------------------------
# Seed taxonomy — ~60 entries covering core K-9 subjects
# ---------------------------------------------------------------------------

TAXONOMY: dict[str, TopicEntry] = {
    # ── MATEMATIKA 1-sinf ──────────────────────────────────────────────────
    "math_1_numbers_1_10": TopicEntry(
        canonical="1 dan 10 gacha sonlar",
        aliases=("1 dan 10", "birdan ongacha", "natural sonlar 1-10"),
        subject="matematika", grade=1, area="sonlar",
    ),
    "math_1_addition_basics": TopicEntry(
        canonical="Qo'shish asoslari",
        aliases=("qo'shish", "qo'shish amali", "yig'indini topish"),
        subject="matematika", grade=1, area="arifmetika",
    ),
    "math_1_subtraction_basics": TopicEntry(
        canonical="Ayirish asoslari",
        aliases=("ayirish", "ayirish amali", "ayirmani topish"),
        subject="matematika", grade=1, area="arifmetika",
    ),

    # ── MATEMATIKA 2-sinf ──────────────────────────────────────────────────
    "math_2_multiplication_table": TopicEntry(
        canonical="Ko'paytirish jadvali",
        aliases=("ko'paytirish jadvali", "jadval", "ko'paytirish"),
        subject="matematika", grade=2, area="arifmetika",
    ),
    "math_2_division_basics": TopicEntry(
        canonical="Bo'lish asoslari",
        aliases=("bo'lish", "bo'lish amali", "bo'linuvchi", "bo'luvchi"),
        subject="matematika", grade=2, area="arifmetika",
    ),

    # ── MATEMATIKA 3-sinf ──────────────────────────────────────────────────
    "math_3_multidigit_add": TopicEntry(
        canonical="Ko'p xonali sonlarni qo'shish",
        aliases=("ko'p xonali", "yuz va minglar qo'shish"),
        subject="matematika", grade=3, area="arifmetika",
    ),
    "math_3_geometry_shapes": TopicEntry(
        canonical="Geometrik shakllar",
        aliases=("geometrik shakllar", "uchburchak", "to'rtburchak", "doira"),
        subject="matematika", grade=3, area="geometriya",
    ),

    # ── MATEMATIKA 4-sinf ──────────────────────────────────────────────────
    "math_4_fractions_intro": TopicEntry(
        canonical="Kasrlarga kirish",
        aliases=("kasr", "kasrlar kirish", "oddiy kasr", "surat", "maxraj"),
        subject="matematika", grade=4, area="kasrlar",
    ),
    "math_4_area_perimeter": TopicEntry(
        canonical="Yuza va perimetr",
        aliases=("yuza", "perimetr", "to'g'ri to'rtburchak yuza"),
        subject="matematika", grade=4, area="geometriya",
    ),

    # ── MATEMATIKA 5-sinf ──────────────────────────────────────────────────
    "math_5_natural_numbers": TopicEntry(
        canonical="Natural sonlar",
        aliases=("natural sonlar", "natural son", "musbat butun"),
        subject="matematika", grade=5, area="sonlar",
    ),
    "math_5_fractions_compare": TopicEntry(
        canonical="Kasrlarni solishtirish",
        aliases=("kasrlarni solishtirish", "kasrlarni taqqoslash"),
        subject="matematika", grade=5, area="kasrlar",
    ),
    "math_5_decimals_intro": TopicEntry(
        canonical="O'nli kasrlarga kirish",
        aliases=("o'nli kasr", "o'nli kasrlar", "vergullik son"),
        subject="matematika", grade=5, area="o'nli_kasrlar",
    ),

    # ── MATEMATIKA 6-sinf ──────────────────────────────────────────────────
    "math_6_fractions_add_same": TopicEntry(
        canonical="Bir xil maxrajli kasrlarni qo'shish",
        aliases=(
            "bir xil maxrajli kasrlar qo'shish",
            "bir xil maxrajli",
            "maxraji teng kasrlar qo'shish",
            "kasrlarni qo'shish bir xil maxraj",
        ),
        subject="matematika", grade=6, area="kasrlar",
    ),
    "math_6_fractions_add_diff": TopicEntry(
        canonical="Har xil maxrajli kasrlarni qo'shish",
        aliases=("har xil maxrajli", "har xil maxrajli kasrlar qo'shish", "umumiy maxraj"),
        subject="matematika", grade=6, area="kasrlar",
    ),
    "math_6_fractions_multiply": TopicEntry(
        canonical="Kasrlarni ko'paytirish",
        aliases=("kasrlarni ko'paytirish", "kasr ko'paytirish"),
        subject="matematika", grade=6, area="kasrlar",
    ),
    "math_6_ratio_proportion": TopicEntry(
        canonical="Nisbat va proporsiya",
        aliases=("nisbat", "proporsiya", "nisbat va proporsiya"),
        subject="matematika", grade=6, area="nisbatlar",
    ),
    "math_6_percent": TopicEntry(
        canonical="Foizlar",
        aliases=("foiz", "foizlar", "foiz hisoblash", "yuzdan bir"),
        subject="matematika", grade=6, area="foizlar",
    ),

    # ── MATEMATIKA 7-sinf ──────────────────────────────────────────────────
    "math_7_algebra_expressions": TopicEntry(
        canonical="Algebraik ifodalar",
        aliases=("algebraik ifoda", "algebraik ifodalar", "o'zgaruvchi"),
        subject="matematika", grade=7, area="algebra",
    ),
    "math_7_linear_equations": TopicEntry(
        canonical="Chiziqli tenglamalar",
        aliases=("chiziqli tenglama", "chiziqli tenglamalar", "birinchi daraja tenglama"),
        subject="matematika", grade=7, area="tenglamalar",
    ),
    "math_7_geometry_angles": TopicEntry(
        canonical="Burchaklar",
        aliases=("burchak", "burchaklar", "to'g'ri burchak", "o'tkir burchak"),
        subject="matematika", grade=7, area="geometriya",
    ),

    # ── MATEMATIKA 8-sinf ──────────────────────────────────────────────────
    "math_8_quadratic_equations": TopicEntry(
        canonical="Kvadrat tenglamalar",
        aliases=("kvadrat tenglama", "kvadrat tenglamalar", "ikkinchi daraja"),
        subject="matematika", grade=8, area="tenglamalar",
    ),
    "math_8_systems_equations": TopicEntry(
        canonical="Tenglamalar sistemasi",
        aliases=("tenglamalar sistemasi", "sistema", "ikki noma'lumli sistema"),
        subject="matematika", grade=8, area="tenglamalar",
    ),
    "math_8_pythagorean": TopicEntry(
        canonical="Pifagor teoremasi",
        aliases=("pifagor", "pifagor teoremasi", "pifagor teoreması"),
        subject="matematika", grade=8, area="geometriya",
    ),

    # ── MATEMATIKA 9-sinf ──────────────────────────────────────────────────
    "math_9_functions": TopicEntry(
        canonical="Funksiyalar",
        aliases=("funksiya", "funksiyalar", "f(x)", "argument va qiymat"),
        subject="matematika", grade=9, area="funksiyalar",
    ),
    "math_9_trigonometry": TopicEntry(
        canonical="Trigonometriya",
        aliases=("trigonometriya", "sinus", "kosinus", "tangens"),
        subject="matematika", grade=9, area="trigonometriya",
    ),

    # ── ONA TILI ──────────────────────────────────────────────────────────
    "uz_all_alphabet": TopicEntry(
        canonical="O'zbek alifbosi",
        aliases=("alifbo", "harflar", "o'zbek alifbosi", "unli undosh"),
        subject="ona-tili", grade=1, area="fonetika",
    ),
    "uz_all_phonetics": TopicEntry(
        canonical="Fonetika",
        aliases=("fonetika", "tovushlar", "unli", "undosh", "bo'g'in"),
        subject="ona-tili", grade=2, area="fonetika",
    ),
    "uz_all_morphology_noun": TopicEntry(
        canonical="Ot",
        aliases=("ot", "otlar", "predmet nomi", "kim? nima?"),
        subject="ona-tili", grade=3, area="morfologiya",
    ),
    "uz_all_morphology_verb": TopicEntry(
        canonical="Fe'l",
        aliases=("fe'l", "fe'llar", "harakat", "nima qildi?", "nima qiladi?"),
        subject="ona-tili", grade=3, area="morfologiya",
    ),
    "uz_all_morphology_adj": TopicEntry(
        canonical="Sifat",
        aliases=("sifat", "sifatlar", "belgini bildiradi", "qanday?"),
        subject="ona-tili", grade=4, area="morfologiya",
    ),
    "uz_all_syntax_sentence": TopicEntry(
        canonical="Gap va uning turlari",
        aliases=("gap", "gap turlari", "darak gap", "so'roq gap", "undov gap"),
        subject="ona-tili", grade=5, area="sintaksis",
    ),
    "uz_all_punctuation": TopicEntry(
        canonical="Tinish belgilari",
        aliases=("tinish belgilari", "vergul", "nuqta", "ikki nuqta", "qo'shtirnoq"),
        subject="ona-tili", grade=5, area="orfografiya",
    ),
    "uz_all_composition": TopicEntry(
        canonical="Matn tuzish va insho",
        aliases=("insho", "matn tuzish", "bayon", "hikoya yozish"),
        subject="ona-tili", grade=6, area="nutq_o'stirish",
    ),

    # ── TABIATSHUNOSLIK / BIOLOGIYA ────────────────────────────────────────
    "bio_all_plants": TopicEntry(
        canonical="O'simliklar",
        aliases=("o'simlik", "o'simliklar", "o'simlik dunyosi", "botanika"),
        subject="biologiya", grade=5, area="botanika",
    ),
    "bio_all_animals": TopicEntry(
        canonical="Hayvonlar",
        aliases=("hayvon", "hayvonlar", "zoologiya", "hayvonot dunyosi"),
        subject="biologiya", grade=6, area="zoologiya",
    ),
    "bio_all_human_body": TopicEntry(
        canonical="Inson tanasi",
        aliases=("inson tanasi", "anatomiya", "inson organizmi", "organlar"),
        subject="biologiya", grade=8, area="anatomiya",
    ),
    "bio_all_cell": TopicEntry(
        canonical="Hujayra",
        aliases=("hujayra", "hujayralar", "hujayra tuzilishi"),
        subject="biologiya", grade=7, area="sitologiya",
    ),

    # ── TARIX ─────────────────────────────────────────────────────────────
    "history_uz_independence": TopicEntry(
        canonical="O'zbekiston mustaqilligi",
        aliases=("mustaqillik", "mustaqillik kuni", "1991 yil", "o'zbekiston mustaqil"),
        subject="tarix", grade=7, area="mustaqillik_davri",
    ),
    "history_ancient_uz": TopicEntry(
        canonical="Qadimgi O'rta Osiyo",
        aliases=("qadimgi o'rta osiyo", "qadimgi davlat", "samarqand tarix"),
        subject="tarix", grade=5, area="qadim_davr",
    ),

    # ── FIZIKA ────────────────────────────────────────────────────────────
    "physics_7_mechanics_motion": TopicEntry(
        canonical="Mexanika — harakat",
        aliases=("mexanika", "harakat", "tezlik", "jism harakati"),
        subject="fizika", grade=7, area="mexanika",
    ),
    "physics_8_electricity": TopicEntry(
        canonical="Elektr toki",
        aliases=("elektr toki", "elektr", "tok kuchi", "volt", "amper"),
        subject="fizika", grade=8, area="elektr",
    ),
    "physics_9_optics": TopicEntry(
        canonical="Optika",
        aliases=("optika", "yorug'lik", "linza", "ko'zgu", "nur"),
        subject="fizika", grade=9, area="optika",
    ),
}


# ---------------------------------------------------------------------------
# Lookup helpers
# ---------------------------------------------------------------------------

def _build_alias_index() -> dict[str, str]:
    """Map each alias (lowercase) → topic_id for O(1) lookup."""
    index: dict[str, str] = {}
    for topic_id, entry in TAXONOMY.items():
        index[entry.canonical.lower()] = topic_id
        for alias in entry.aliases:
            index[alias.lower()] = topic_id
    return index


_ALIAS_INDEX: dict[str, str] = _build_alias_index()


def find_topic_id(raw_topic: str) -> tuple[str | None, float]:
    """Return (topic_id, confidence) for a raw LLM-generated topic string.

    Exact alias match → 0.95 confidence.
    Substring match → 0.70 confidence.
    No match → (None, 0.0).
    """
    normalized = raw_topic.lower().strip()
    if not normalized:
        return None, 0.0

    # Exact match
    if normalized in _ALIAS_INDEX:
        return _ALIAS_INDEX[normalized], 0.95

    # Substring match — topic_id whose alias is contained in raw_topic
    for alias, topic_id in _ALIAS_INDEX.items():
        if alias in normalized or normalized in alias:
            return topic_id, 0.70

    return None, 0.0


def get_topic(topic_id: str) -> TopicEntry | None:
    return TAXONOMY.get(topic_id)
