"""Scripted (canned) intent matching — conservative whole-message match."""

from duyo.services.scripted import match_scripted


def test_exact_greeting_matches():
    assert match_scripted("Salom") is not None
    assert "DUYO" in match_scripted("assalomu alaykum")


def test_case_and_punctuation_insensitive():
    assert match_scripted("  SALOM!! ") == match_scripted("salom")


def test_thanks_and_farewell():
    assert match_scripted("rahmat") is not None
    assert match_scripted("xayr") is not None


def test_real_question_falls_through():
    # A real question that merely starts with a greeting must NOT be hijacked.
    assert match_scripted("salom, menga matematikani tushuntir") is None
    assert match_scripted("fotosintez nima") is None


def test_non_uzbek_falls_through():
    assert match_scripted("salom", language="ru") is None
    assert match_scripted("salom", language="en") is None
