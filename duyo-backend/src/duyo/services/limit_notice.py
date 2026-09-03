"""What a child is told when they run out of messages for the day.

The old text ended "Ko'proq suhbat uchun obunani yangilang" — renew your
subscription. The app has no purchase path: it does not sell a subscription, on
Android or anywhere else, so the sentence steered a blocked 13-year-old towards
something that does not exist. It was also Uzbek only, shown to Russian- and
English-speaking children as-is.

What replaces it says the two true things: how many messages the day held, and
when the next day starts. `billing/limits.py` counts from UTC midnight, which in
Tashkent is 05:00 — so 05:00 is the hour named here, and it is named as Tashkent
time rather than left as a bare number a child would read as their own midnight.
"""

from __future__ import annotations

from duyo.models.child import Language

#: UTC midnight in Tashkent, which is where billing/limits.py rolls the day
#: over. Uzbekistan is UTC+5 with no daylight saving, so this is a constant and
#: not something to derive per request.
_RESET_LOCAL_HOUR = "05:00"

_TEMPLATES = {
    Language.UZ: (
        "Bugungi xabarlar tugadi ({used}/{limit}). Yangi kun Toshkent vaqti "
        "bilan soat {reset} da boshlanadi — o'shanda yana yozishing mumkin."
    ),
    Language.RU: (
        "Сообщения на сегодня закончились ({used}/{limit}). Новый день "
        "начинается в {reset} по ташкентскому времени — тогда снова напишешь."
    ),
    Language.EN: (
        "You've used today's messages ({used}/{limit}). The new day starts at "
        "{reset} Tashkent time — you can write again then."
    ),
}


def daily_limit_message(language: Language | None, *, used: int, limit: int | None) -> str:
    """The over-limit notice in the child's own language.

    `limit` is Optional on LimitStatus because a paid tier has none; a caller
    that reaches this with None would otherwise print "None" at a child, so it
    falls back to the count already used.
    """
    template = _TEMPLATES.get(language or Language.UZ, _TEMPLATES[Language.UZ])
    return template.format(used=used, limit=limit if limit is not None else used,
                           reset=_RESET_LOCAL_HOUR)
