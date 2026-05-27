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
