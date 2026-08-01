"""Tests for the streaming crisis detector.

Layer 1 (`KeywordCrisisDetector`) takes one finished text. Voice mode
delivers transcription in small fragments (often single words). This
stream wrapper accumulates fragments and re-runs Layer 1 monotonically:
once a level is reached, it never downgrades — that protects against a
transient mis-transcription erasing a real signal mid-utterance.
"""

import pytest

from duyo.crisis.detector import CrisisLevel, KeywordCrisisDetector
from duyo.crisis.stream import StreamCrisisDetector


@pytest.fixture
def stream() -> StreamCrisisDetector:
    return StreamCrisisDetector()


def test_initial_state_is_green(stream: StreamCrisisDetector):
    assert stream.result.level == CrisisLevel.GREEN
    assert stream.text == ""


def test_empty_fragment_changes_nothing(stream: StreamCrisisDetector):
    result = stream.feed("")
    assert result.level == CrisisLevel.GREEN
    assert stream.text == ""


def test_safe_fragments_stay_green(stream: StreamCrisisDetector):
    stream.feed("Salom DUYO")
    stream.feed(", bugun ")
    result = stream.feed("matematika o'rgandim")
    assert result.level == CrisisLevel.GREEN
    assert "matematika" in stream.text


def test_red_keyword_in_single_fragment_triggers_red(stream: StreamCrisisDetector):
    result = stream.feed("men o'zimni o'ldiraman")
    assert result.level == CrisisLevel.RED
    assert len(result.matches) >= 1


def test_red_keyword_split_across_fragments_still_triggers(
    stream: StreamCrisisDetector,
):
    """The phrase "o'zimni o'ldiraman" is split into multiple Live fragments."""
    stream.feed("Men")
    stream.feed(" o'zimni")
    stream.feed(" o'ldira")
    result = stream.feed("man")
    assert result.level == CrisisLevel.RED


def test_level_is_monotonic_never_downgrades(stream: StreamCrisisDetector):
    """Once RED, subsequent benign fragments cannot bring it back to GREEN."""
    stream.feed("o'zimni o'ldiraman")
    assert stream.result.level == CrisisLevel.RED
    # …child keeps talking about ordinary things
    result = stream.feed(" lekin avval kitob o'qiyman")
    assert result.level == CrisisLevel.RED


def test_orange_then_red_escalates(stream: StreamCrisisDetector):
    """ORANGE arrives first (abuse), then RED (suicidal) — final state is RED."""
    stream.feed("otam meni uradi")
    assert stream.result.level == CrisisLevel.ORANGE
    stream.feed(" va men o'zimni o'ldirmoqchiman")
    assert stream.result.level == CrisisLevel.RED


def test_red_then_orange_does_not_downgrade(stream: StreamCrisisDetector):
    stream.feed("o'zimni o'ldiraman")
    stream.feed(" va otam meni uradi")
    assert stream.result.level == CrisisLevel.RED


def test_text_property_concatenates_all_fragments(stream: StreamCrisisDetector):
    fragments = ["Salom", " bugun", " maktab", "da o'qib"]
    for f in fragments:
        stream.feed(f)
    assert stream.text == "".join(fragments)


def test_reset_clears_state():
    s = StreamCrisisDetector()
    s.feed("o'zimni o'ldiraman")
    s.reset()
    assert s.result.level == CrisisLevel.GREEN
    assert s.text == ""


def test_inject_custom_detector():
    """Callers may pass a pre-built detector (avoid re-loading keyword table)."""
    custom = KeywordCrisisDetector()
    s = StreamCrisisDetector(detector=custom)
    s.feed("safe")
    assert s.result.level == CrisisLevel.GREEN


# ---------------------------------------------------------------------------
# Layer 2 fail-safe: a missing/broken client must not 500 the chat turn
# ---------------------------------------------------------------------------


async def test_layer2_falls_back_to_layer1_when_client_unavailable(monkeypatch):
    """get_client() raising (no GOOGLE_API_KEY) must degrade, not propagate.

    Regression: get_client() used to be called above the try block, so a
    missing key raised RuntimeError straight out of classify() and the whole
    chat turn returned 500 — with no crisis screening at all.
    """
    from duyo.models.crisis_event import CrisisLevel
    from duyo.services import crisis_l2

    def _boom():
        raise RuntimeError("GOOGLE_API_KEY is not set")

    monkeypatch.setattr(crisis_l2, "get_client", _boom)

    result = await crisis_l2.classify("salom", CrisisLevel.YELLOW)

    assert result.level == CrisisLevel.YELLOW  # Layer 1 verdict preserved
    assert result.confidence == 0.0
    assert "layer2_error" in result.reasoning
