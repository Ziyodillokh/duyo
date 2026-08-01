"""What DUYO says when it cannot reach the model.

These cover the copy. The guard itself — that a raising LLM call yields a 200
with this text rather than an HTTP 500 — is verified by driving the running
server with no GOOGLE_API_KEY set, which is the exact failure that surfaced it.
A fake-session unit test of chat_turn() would assert the mock, not the handler.

When the model can't be reached, the child gets an answer — not a 500.

Found by running the app with no GOOGLE_API_KEY: every LLM path in the chat
endpoint was unguarded, so a missing key, an exhausted quota (429) or a network
blip surfaced to the child as an HTTP 500. For a companion app that exists to
be there when a child is struggling, an error screen is the wrong failure.

The message and its crisis screening are recorded before the model is called,
so a failure here costs the reply and never the safety signal.
"""

from __future__ import annotations

from duyo.api.v1 import chat as mod


def test_every_language_has_a_fallback_line():
    for lang in ("uz", "ru", "en"):
        text = mod.LLM_UNAVAILABLE[lang]
        assert len(text) > 30
        # Honest, not evasive: it says something is wrong and invites a retry.
        assert text.strip().endswith((".", "!"))


def test_fallback_never_claims_the_child_did_something_wrong():
    """A child must not read a system failure as their own fault."""
    for text in mod.LLM_UNAVAILABLE.values():
        lowered = text.lower()
        for blame in ("sen ", "ты ", "you did", "noto'g'ri", "неправильно", "wrong"):
            assert blame not in lowered


# --- which language to apologise in ------------------------------------------
# The child is answered in the language they wrote in, not the one on their
# profile. Getting this wrong reads to a bilingual child as not being listened
# to — the same rule the real replies follow.

RU_HELLO = "Привет, как дела?"
RU_WHY = "Почему небо синее?"
UZ_CYRILLIC = "Салом, бугун џахши кун"


def test_russian_message_gets_a_russian_apology():
    assert mod._reply_language(RU_HELLO, "uz") == "ru"
    assert mod._reply_language(RU_WHY, "uz") == "ru"


def test_english_message_gets_an_english_apology():
    assert mod._reply_language("Hello, how are you?", "uz") == "en"
    assert mod._reply_language("can you help me", "uz") == "en"


def test_uzbek_message_gets_an_uzbek_apology():
    assert mod._reply_language("Salom, bugun yaxshi kun", "en") == "uz"
    assert mod._reply_language("menga yordam kerak", "ru") == "uz"


def test_uzbek_cyrillic_is_not_mistaken_for_russian():
    """Uzbek Cyrillic shares most of the alphabet; a uz profile keeps Uzbek."""
    assert mod._reply_language(UZ_CYRILLIC, "uz") == "uz"


def test_an_unrecognisable_message_falls_back_to_the_profile():
    assert mod._reply_language("...", "ru") == "ru"
    assert mod._reply_language("42", "en") == "en"
    assert mod._reply_language("", "uz") == "uz"
