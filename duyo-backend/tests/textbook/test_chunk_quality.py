"""Tests for the reusable chunk-quality filter.

Fixtures are REAL samples pulled from ingested grade-6 textbooks so the filter
is validated against the actual OCR noise it must remove — and, critically,
against real (often short) lesson content it must never drop.
"""

from duyo.textbook.chunk_quality import is_low_quality

# ── Genuine noise that MUST be dropped ──────────────────────────────────────

GARBAGE = [
    # cover / title / copyright front-matter
    (
        "O'zbekiston Respublikasi Xalq ta'limi vazirligi\n\n"
        "UMUMIY O‘RTA TA'LIM MAKTABLARINING 6- SINFI UCHUN DARSLIK\n\n"
        "Qayta ishlangan va to‘ldirilgan to‘rtinchi nashri"
    ),
    "Pratov va boshq., 2009-2017\nISBN 978-9943-01-421-3 «Oʻzbekiston» NMIU, 2009-2017",
    "Respublika maqsadli kitob jamg'armasi mablag'lari hisobidan ijara uchun chop etildi.",
    "Mualliflar tomonidan tayyorlangan elektron ilova",
    "UO‘K 821.512.133\nKBK 84(5Ў)",
    # table-of-contents dotted-leader lines (real ona-tili TOC)
    "66 Mustahkamlash ...........шш-ш ишнинг га 68 Ко такси fear... cece "
    "ccccceccsseceeseeeesseeeceseeeeseeeeseeesssseesssssesss 69 Ko‘makchi fe'l",
    "So‘z turkumlari .................................................. 12",
    # digit/symbol soup (botanika figure labels)
    "ван 496 3 – xloroplast: Oy Sara HI 4 — yadro; 5 — xromoplast; "
    "б far: 3 6 — vakuol. o 4255 14572 = A 2 1",
    "WuxK 7 7 9 9 i7 9 9 09 0707 7 a7 b s17070 X1 9X1 90707 X1 X19X1 9 19 19 1",
    # mixed-script OCR soup
    "Mactßaba Üanpgo Г comép Д comépab Д дagбb",
    # repetitive OCR loop — same token dominates (real jadval/loop debris)
    "jadval jadval jadval jadval jadval jadval jadval jadval jadval",
]

# ── Real lesson content that MUST be kept (many are short!) ──────────────────

GOOD = [
    # short historical facts — short but 100% real content
    "Mil. avv. I asr da Xorazmda mahalliy taqvim ishlab chiqilgan.",
    "misrliklar, xudolar odamlar orasida yashaydi, deb hisoblashgan",
    "Xammurapi qonunlari ta'lon-taroj va o'g'rilik kabi jinoyatlarni "
    "to'xtatishda katta ahamiyatga ega bo'lgan.",
    "Afina va Sparta davlatlari Qadimgi Yunonistonning eng yirik "
    "shahar-davlatlari bo'lgan.",
    # comma-separated factual lists
    "Materiklar va okeanlar. Yevrosiyo, Afrika, Shimoliy Amerika.",
    "Ptah, Xathor, Apis, Isida, Amon-Ra, Maat, Tot, Osiris.",
    # definition / explanation
    "Fotosintez. Yashil oʻsimliklar quyosh nuri yordamida anorganik "
    "moddalardan organik moddalar hosil qiladi.",
    "Materik - bu hamma tomondan suv bilan oʻralgan katta quruqlik.",
    # a real paragraph with a short noisy OCR tail — keep (good part embeds)
    (
        "Alisher NAVOIY (1441-1501) Siz buyuk bobokalonimiz hazrat Alisher "
        "Navoiy haqida koʻp eshitgansiz, kitoblar oʻqigansiz. Navoiyning "
        "hayoti va ijodini chuqurroq oʻrganishni davom ettiramiz. "
        "U-U-U-U LU MUAYAN A KAAAAN"
    ),
    # bilingual line (Uzbek + Russian term) — substantial minority, real
    "Geografik qobiq - географическая оболочка - Yerning tabiiy qatlami.",
]


class TestGarbageDropped:
    def test_all_garbage_is_low_quality(self) -> None:
        for sample in GARBAGE:
            assert is_low_quality(sample) is True, f"should drop: {sample[:55]!r}"


class TestContentKept:
    def test_all_content_is_kept(self) -> None:
        for sample in GOOD:
            assert is_low_quality(sample) is False, f"should keep: {sample[:55]!r}"


class TestEdgeCases:
    def test_empty_string(self) -> None:
        assert is_low_quality("") is True

    def test_whitespace_only(self) -> None:
        assert is_low_quality("   \n\n  ") is True

    def test_normal_paragraph_kept(self) -> None:
        text = (
            "O'simlik organlari hujayralardan tuzilgan bo'lib, ularning shakli "
            "va vazifasi turlichadir. Har bir hujayra muhim vazifani bajaradi."
        )
        assert is_low_quality(text) is False
