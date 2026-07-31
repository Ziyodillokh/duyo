"""Tests for the Layer 1 keyword crisis detector.

These tests double as a living specification of what Layer 1 catches and
what it explicitly does NOT catch (Layer 2/3 territory).
"""

import pytest

from duyo.crisis.detector import CrisisCategory, CrisisLevel

# ---------------------------------------------------------------------------
# Safe messages — must NOT trigger
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "text",
    [
        "Salom DUYO, bugun maktabda matematika bo'ldi",
        "Hello DUYO, how are you?",
        "Привет, я очень устал сегодня",
        "Men kitob o'qishni yaxshi ko'raman",
        "I love playing football",
        "",
        "   ",
    ],
)
def test_safe_messages_return_green(detector, text):
    result = detector.check(text)
    assert result.level == CrisisLevel.GREEN
    assert result.is_safe
    assert result.matches == ()


# ---------------------------------------------------------------------------
# Suicidal ideation — must trigger RED across all three languages
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "text,expected_lang",
    [
        ("Men o'zimni o'ldiraman", "uz"),
        ("ozimni oldiraman, charchadim", "uz"),
        ("Hech kimga keragim yo'q", "uz"),
        ("Я хочу умереть", "ru"),
        ("Никому не нужен я", "ru"),
        ("I want to die", "en"),
        ("I will kill myself", "en"),
        ("no reason to live anymore", "en"),
    ],
)
def test_suicidal_ideation_triggers_red(detector, text, expected_lang):
    result = detector.check(text)
    assert result.level == CrisisLevel.RED, f"Expected RED for: {text!r}"
    assert CrisisCategory.SUICIDAL in result.categories
    assert any(m.language.value == expected_lang for m in result.matches)


# ---------------------------------------------------------------------------
# Self-harm — ORANGE
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "text",
    [
        "Men o'zimni kesaman",
        "I cut myself last night",
        "Я порежу себя",
    ],
)
def test_self_harm_triggers_orange_or_higher(detector, text):
    result = detector.check(text)
    assert result.level in {CrisisLevel.ORANGE, CrisisLevel.RED}
    assert CrisisCategory.SELF_HARM in result.categories


# ---------------------------------------------------------------------------
# Violence toward others — RED
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "text",
    [
        "Maktabga pichoq olib boraman",
        "I will bring a knife to school",
        "Принесу нож в школу",
    ],
)
def test_violence_intent_triggers_red(detector, text):
    result = detector.check(text)
    assert result.level == CrisisLevel.RED
    assert CrisisCategory.VIOLENCE in result.categories


# ---------------------------------------------------------------------------
# Abuse victim — ORANGE (special: NO auto-parent alert, per TZ §9.6)
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "text",
    [
        "Otam meni uradi",
        "Otam meni har kuni uradi",          # adverb between subject & verb
        "Onam meni kecha urdi",              # past tense + adverb
        "Akam meni doim kaltaklaydi",        # sibling + frequency
        "My dad hits me every day",
        "They beat me up at school",
        "Папа меня бьёт",
        "Меня вчера избили",
        "Hech kimga aytma, lekin amaki noto'g'ri qiladi",
        "Qo'lim ko'kargan, uyda urishdi",
    ],
)
def test_abuse_victim_signals_trigger_orange(detector, text):
    result = detector.check(text)
    assert result.level == CrisisLevel.ORANGE
    assert CrisisCategory.ABUSE_VICTIM in result.categories


# ---------------------------------------------------------------------------
# Neglect — ORANGE (special: NO auto-parent alert, same rationale as abuse)
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "text",
    [
        "Uyda hech kim yo'q, meni yolg'iz tashlab ketishdi",
        "Ovqat bermaydilar, kunlab ovqatlanmadim",
        "No one is home, they left me alone for days",
        "Дома никого нет, меня бросили одного",
    ],
)
def test_neglect_signals_trigger_orange(detector, text):
    result = detector.check(text)
    assert result.level == CrisisLevel.ORANGE
    assert CrisisCategory.NEGLECT in result.categories


# ---------------------------------------------------------------------------
# Bullying — ORANGE (normal auto-parent alert applies; parent is an ally here)
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "text",
    [
        "Meni maktabda masxara qilishadi",
        "Meni hech kim bilan o'ynashmaydi",
        "They bully me at school",
        "Надо мной издеваются в школе",
    ],
)
def test_bullying_signals_trigger_orange(detector, text):
    result = detector.check(text)
    assert result.level == CrisisLevel.ORANGE
    assert CrisisCategory.BULLYING in result.categories


# ---------------------------------------------------------------------------
# Eating disorder — YELLOW (concerning, not immediate danger from L1 alone)
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "text",
    [
        "Ovqatlanishni to'xtatdim",
        "Ovqatdan keyin qusaman",
        "I make myself throw up",
        "Не ем уже несколько дней",
    ],
)
def test_eating_disorder_signals_trigger_yellow(detector, text):
    result = detector.check(text)
    assert result.level == CrisisLevel.YELLOW
    assert CrisisCategory.EATING_DISORDER in result.categories


# ---------------------------------------------------------------------------
# Substance abuse — ORANGE
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "text",
    [
        "Men aroq ichdim",
        "Men giyohvand modda ishlatdim",
        "I took drugs last night",
        "Я употребляю наркотики",
    ],
)
def test_substance_abuse_signals_trigger_orange(detector, text):
    result = detector.check(text)
    assert result.level == CrisisLevel.ORANGE
    assert CrisisCategory.SUBSTANCE_ABUSE in result.categories


# ---------------------------------------------------------------------------
# Normalisation — curly quotes, mixed case, extra whitespace
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "text",
    [
        "men O’ZIMNI o’ldiraman",      # curly apostrophes + mixed case
        "   I  want   to    die   ",   # extra whitespace
        "I WANT TO DIE",                # all caps
    ],
)
def test_normalisation_still_catches_phrases(detector, text):
    result = detector.check(text)
    assert result.level == CrisisLevel.RED


# ---------------------------------------------------------------------------
# Multiple categories in one message — picks the highest level
# ---------------------------------------------------------------------------


def test_multiple_categories_returns_highest_level(detector):
    text = "Otam meni uradi va men o'zimni o'ldiraman"
    result = detector.check(text)
    assert result.level == CrisisLevel.RED
    assert {CrisisCategory.ABUSE_VICTIM, CrisisCategory.SUICIDAL}.issubset(result.categories)


def test_suicidal_moqchiman_form_also_caught(detector):
    """Future tense / volitional form 'o'ldirmoqchiman' must trigger RED."""
    result = detector.check("Men o'zimni o'ldirmoqchiman")
    assert result.level == CrisisLevel.RED
    assert CrisisCategory.SUICIDAL in result.categories


# ---------------------------------------------------------------------------
# Known false-negative territory — Layer 1 cannot catch metaphor / subtle
# patterns. These tests document the limitation so future ML layers can
# regression-test against them.
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "text",
    [
        "Bu kitob meni shu darajada zeriktirayapti, o'lib qolaman",  # metaphor
        "Hech kim meni sevmaydi",                                     # subtle, requires context
        "Yo'qolib ketsam yaxshi bo'lardi",                            # passive ideation
    ],
)
def test_layer1_misses_subtle_or_metaphorical_signals(detector, text):
    # These SHOULD return GREEN from Layer 1. Layer 2 (Claude assessment)
    # and Layer 3 (BERT classifier) are responsible for catching them.
    result = detector.check(text)
    assert result.level == CrisisLevel.GREEN, (
        f"Layer 1 unexpectedly flagged a subtle phrase: {text!r}. "
        "If this becomes a hard match, update KEYWORDS list with clinical review."
    )


# ---------------------------------------------------------------------------
# Immutability contract
# ---------------------------------------------------------------------------


def test_result_is_immutable(detector):
    result = detector.check("Men o'zimni o'ldiraman")
    with pytest.raises(Exception):  # FrozenInstanceError or AttributeError
        result.level = CrisisLevel.GREEN  # type: ignore[misc]


# ---------------------------------------------------------------------------
# Apostrophe variants (Uzbek orthography)
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "apostrophe",
    [
        "'",       # U+0027 plain — what the keyword lists use
        "\u02bb",  # U+02BB MODIFIER LETTER TURNED COMMA — official Uzbek oʻ/gʻ
        "\u02bc",  # U+02BC MODIFIER LETTER APOSTROPHE — tutuq belgisi (aʼzo)
        "\u2019",  # U+2019 right single quote — phone keyboards
        "\u2018",  # U+2018 left single quote
        "`",       # U+0060 backtick
        "\u00b4",  # U+00B4 acute accent
        "\u2032",  # U+2032 prime
        "\uff07",  # U+FF07 fullwidth apostrophe
    ],
)
def test_apostrophe_variants_all_detected(detector, apostrophe):
    """A standard Uzbek keyboard emits U+02BB, not U+0027.

    Regression: before _APOSTROPHES covered the MODIFIER LETTER forms,
    `oʻldirgim keladi` scored GREEN while `o'ldirgim keladi` scored RED —
    Layer 1 missed real messages typed the orthographically correct way.
    """
    result = detector.check(f"o{apostrophe}ldirgim keladi")
    assert result.level == CrisisLevel.RED, (
        f"Apostrophe U+{ord(apostrophe):04X} broke keyword matching"
    )


@pytest.mark.parametrize(
    "text",
    [
        "bugun maktabda ko\u02bbp o\u02bbqidim",
        "do\u02bbstlarim bilan o\u02bbynadim",
        "g\u02bballa haqida she\u02bbr o\u02bbqidim",
    ],
)
def test_apostrophe_folding_does_not_cause_false_positives(detector, text):
    """Folding apostrophes must not turn everyday Uzbek into a crisis hit."""
    assert detector.check(text).level == CrisisLevel.GREEN
