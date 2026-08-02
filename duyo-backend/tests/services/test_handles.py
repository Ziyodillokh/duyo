"""Child-chosen handles.

A handle is shown on every message the child sends, so a free-text field here
is a broadcast field. These tests pin what it may and may not carry.
"""

import pytest

from duyo.services.social import (
    _HANDLE_WORDS,
    HandleError,
    suggest_handles,
    validate_handle,
)


def test_ordinary_handles_are_accepted():
    for handle in ("Burgut-42", "kapalak", "Tez-Yulbars", "Zilol99", "Ali"):
        assert validate_handle(handle) == handle


def test_whitespace_is_collapsed_not_rejected():
    assert validate_handle("  Burgut-42  ") == "Burgut-42"


def test_length_bounds():
    with pytest.raises(HandleError):
        validate_handle("ab")
    with pytest.raises(HandleError):
        validate_handle("a" * 21)


def test_a_name_plus_identifying_detail_is_rejected():
    """"Ali 42-maktab" is the shape that leaks a child's school."""
    with pytest.raises(HandleError):
        validate_handle("Ali 42-maktab")


def test_contact_shapes_are_rejected():
    for handle in ("@alikarimov", "ali.karimov", "901234567", "t.me/ali"):
        with pytest.raises(HandleError):
            validate_handle(handle)


def test_digits_alone_are_rejected():
    with pytest.raises(HandleError):
        validate_handle("12345")


def test_long_digit_runs_are_rejected():
    """Four digits in a row is a year or a phone fragment, not a nickname."""
    with pytest.raises(HandleError):
        validate_handle("Burgut2011")
    assert validate_handle("Burgut-42") == "Burgut-42"


def test_uzbek_apostrophes_are_allowed():
    assert validate_handle("Yo‘lbars") == "Yo‘lbars"


def test_default_words_carry_no_gender():
    """The first version handed boys names like "Lola" and "Shahzoda"."""
    banned = {
        "lola", "shahzoda", "qorqiz", "nilufar", "sherzod", "ohu", "yulduz",
    }
    assert not {w.casefold() for w in _HANDLE_WORDS} & banned


def test_suggestions_are_distinct_and_valid():
    suggestions = suggest_handles(6)
    assert len(suggestions) == 6
    assert len(set(suggestions)) == 6
    for handle in suggestions:
        assert validate_handle(handle) == handle
