"""Peer-harm detection for child-to-child messages.

Deliberately NOT part of `duyo.crisis`, even though it looks similar.

The crisis detector answers "is the AUTHOR in danger?" and its whole downstream
flow is built on that answer: show the author helplines, alert the author's
parent, offer support. Grooming and sexual solicitation invert the subject —
the author is the danger, to someone else. Routing those through CrisisCategory
would hand a helpline to the person doing the harm and tell their parent that
their child is in crisis, while the child actually at risk hears nothing.

So this module has its own categories, its own severity ladder, and its own
review queue. `screen_peer_message` runs both.

## Why weighted signals rather than a keyword list

Children say alarming-sounding things innocently all day. "Sen nechchi
yoshdasan?" is how two ten-year-olds start a conversation, not grooming.
"Onamga aytmadim" is usually about a bad grade. A flat keyword list either
misses real grooming (which rarely uses one damning word) or blocks ordinary
friendship, and a filter children experience as random is one they route
around — which costs more safety than it buys.

Grooming is a *pattern*: isolate, build secrecy, escalate intimacy, move
off-platform, meet. So:

- STRONG signals block on their own — explicit sexual content has no innocent
  reading in a message between two children who met through a homework app.
- WEAK signals block only in combination (>= 2 distinct ones). A photo request
  is innocent; a photo request wrapped in secrecy is not.

## What this is not

A keyword matcher cannot detect patient grooming, which is measured in weeks
of ordinary-looking messages. This raises the floor; it does not make peer
chat safe by itself. The review queue (`GET /admin/safety/peer-flags`) is the
part that catches what this misses, and it only works if a human reads it.

Never raises: a detector that crashes on hostile input would let that exact
input through, which is the failure mode this exists to prevent.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from enum import Enum

from duyo.crisis.detector import _normalize


class PeerHarmCategory(str, Enum):
    """What kind of harm the message carries toward its RECIPIENT."""

    SEXUAL = "sexual"            # sexual content or solicitation
    GROOMING = "grooming"        # secrecy + intimacy + isolation pattern
    MEETING = "meeting"          # arranging an offline meeting (policy block)
    THREAT = "threat"            # threats or intimidation
    DEGRADATION = "degradation"  # slurs, humiliation, targeted cruelty


class PeerHarmSeverity(str, Enum):
    """How fast an adult needs to look at this."""

    POLICY = "policy"      # blocked by rule; usually innocent intent
    HIGH = "high"          # a child is being hurt now
    CRITICAL = "critical"  # possible predatory behaviour


SEVERITY: dict[PeerHarmCategory, PeerHarmSeverity] = {
    PeerHarmCategory.SEXUAL: PeerHarmSeverity.CRITICAL,
    PeerHarmCategory.GROOMING: PeerHarmSeverity.CRITICAL,
    PeerHarmCategory.THREAT: PeerHarmSeverity.HIGH,
    PeerHarmCategory.DEGRADATION: PeerHarmSeverity.HIGH,
    PeerHarmCategory.MEETING: PeerHarmSeverity.POLICY,
}

_SEVERITY_RANK: dict[PeerHarmSeverity, int] = {
    PeerHarmSeverity.POLICY: 0,
    PeerHarmSeverity.HIGH: 1,
    PeerHarmSeverity.CRITICAL: 2,
}


# How many trailing letters an Uzbek stem may pick up. Six covers the stacked
# suffixes that actually occur here (`uchrashamiz` + `mi`, `rasmingni` +
# `larni`); more starts swallowing the next word's worth of meaning.
_SUFFIX = r"\w{0,6}"


def _group(*, strict: tuple[str, ...] = (), stems: tuple[str, ...] = ()) -> re.Pattern[str]:
    r"""Compile one signal group.

    Two matching modes, because the three languages inflect differently:

    `strict` — bounded on both ends. Used for Russian and English, and for
    Uzbek phrases that do not take suffixes. Bounded rather than the substring
    test the crisis detector does, because these terms are much shorter than
    crisis phrases: bare `sex` is inside `unisex`, and `qiz` (girl) is inside
    `qizil` (red) and `qiziq` (interesting).

    `stems` — bounded at the start, allowed to pick up a suffix at the end.
    Uzbek is agglutinative: `uchrashamiz` becomes `uchrashamizmi` to ask the
    question, and a right-hand boundary misses every inflected form. This is
    the same trap that made goal titles fail to match earlier — Uzbek appends
    where Russian replaces, so the two need different rules.

    Stems must stay specific enough to survive the loosened end: `uchrash` +
    suffix would also match `uchrashuv` (a class meeting), so the stems below
    keep their personal endings.

    Terms are written with the straight `'` because `_normalize` has already
    folded every Uzbek apostrophe variant (U+02BB `oʻ`, U+02BC `aʼ`, …) onto
    it. Reusing that function rather than reimplementing it is deliberate —
    getting it wrong once already let `oʻldirgim keladi` past Layer 1.
    """
    parts = []
    if strict:
        parts.append(rf"(?<!\w)(?:{'|'.join(strict)})(?!\w)")
    if stems:
        parts.append(rf"(?<!\w)(?:{'|'.join(stems)}){_SUFFIX}(?!\w)")
    return re.compile("|".join(parts))


def _phrases(*terms: str) -> re.Pattern[str]:
    """Strict-only group. Thin wrapper kept for the many groups that need it."""
    return _group(strict=terms)


# ---------------------------------------------------------------------------
# STRONG — block on their own.
# ---------------------------------------------------------------------------

# Explicit sexual vocabulary and solicitation. Between two children matched by
# a homework app there is no innocent reading of these, which is what makes
# them safe to act on alone.
_SEXUAL = _group(
    strict=(
        # Russian. Adjectives are listed in every case form that occurs — the
        # test suite caught `голую` (accusative) slipping past a list that had
        # only `голая`, which is exactly the message a predator would send.
        r"секс", r"сексом", r"сексуальн\w*",
        r"гол(?:ая|ый|ое|ые|ую|ым|ых|ыми|ой)", r"голышом",
        r"разденься", r"раздевайся", r"без одежды",
        r"интим", r"интимн\w*", r"грудь покажи", r"покажи грудь",
        r"нюдсы", r"нюды", r"пошли нюдсы",
        # English
        r"sex", r"sexy", r"sexual", r"nude", r"nudes", r"naked",
        r"undress", r"take off your clothes", r"send nudes", r"horny",
    ),
    stems=(
        # Uzbek
        r"seks", r"jinsiy aloqa", r"jinsiy",
        r"yalang'och", r"yalangoch",
        r"ko'kraging", r"kokraging", r"ko'krakni", r"kokrakni",
        r"tanangni ko'rsat", r"tanangni korsat",
        r"kiyimingni yech", r"kiyimsiz", r"shahvat",
    ),
)

# Threats aimed at the recipient.
_THREAT = _group(
    strict=(
        r"убью тебя", r"я тебя убью", r"изобью", r"найду тебя", r"пожалеешь",
        r"i will kill you", r"i'll kill you", r"beat you up", r"you'll regret",
        r"i will find you", r"i'll find you",
    ),
    stems=(
        r"seni o'ldir", r"seni oldir", r"seni ur", r"kaltaklay",
        r"seni topaman", r"pushaymon bo'la", r"pushaymon bola",
        r"tanangni sindir", r"seni yo'q qila", r"seni yoq qila",
    ),
)

# Targeted cruelty. Kept to unambiguous degradation — ordinary teasing between
# friends must not land a child in a safety queue.
_DEGRADATION = _group(
    strict=(
        r"убей себя", r"сдохни", r"ты никто", r"ты урод", r"тебе не место",
        r"kill yourself", r"kys", r"you should die", r"nobody wants you",
        r"you're worthless", r"youre worthless",
    ),
    stems=(
        r"o'l endi", r"ol endi", r"o'zingni o'ldir", r"ozingni oldir",
        r"hech kimga keraksiz", r"jirkanch", r"ahmoqsan yo'qol",
        r"sen hech kimsan", r"tug'ilmasliging kerak edi",
    ),
)

# ---------------------------------------------------------------------------
# WEAK — innocent alone, a pattern together. Need >= 2 DISTINCT groups.
# ---------------------------------------------------------------------------

# "Don't tell anyone" — the load-bearing beam of grooming, and also how a child
# shares an ordinary secret. Alone it means nothing.
_W_SECRECY = _group(
    strict=(
        r"никому не говори", r"не говори родителям", r"это наш секрет",
        r"удали это", r"пусть никто не знает",
        r"don't tell anyone", r"dont tell anyone", r"don't tell your parents",
        r"dont tell your parents", r"our secret", r"delete this",
        r"keep it secret",
    ),
    stems=(
        # `aytma` -> `aytmagin`, `aytmang`: the polite and emphatic forms are
        # the ones an adult-sounding message actually uses.
        r"hech kimga aytm", r"ota-onangga aytm", r"onangga aytm",
        r"otangga aytm", r"sir saqla", r"bu bizning sirimiz",
        r"o'chirib tashla", r"ochirib tashla", r"hech kim bilmasin",
    ),
)

# Asking for images. Ordinary between friends; not ordinary beside secrecy.
_W_PHOTO = _group(
    strict=(
        r"пришли фото", r"скинь фото", r"отправь селфи", r"пришли видео",
        r"скинь фотку", r"пришли фотку",
        r"send me a photo", r"send a pic", r"send pics",
        r"send me your picture", r"send a selfie", r"send a video",
    ),
    stems=(
        r"rasmingni yubor", r"rasm yubor", r"suratingni yubor",
        r"selfi yubor", r"o'zingni suratga ol", r"ozingni suratga ol",
        r"video yubor",
    ),
)

# Age and appearance probing.
_W_AGE_LOOKS = _phrases(
    r"nechchi yoshdasan", r"necha yoshdasan", r"yoshing nechchi",
    r"qanday ko'rinasan", r"qanday korinasan", r"chiroylimisan",
    r"bo'yin qancha", r"boyin qancha",
    r"сколько тебе лет", r"как ты выглядишь", r"ты красивая", r"ты красивый",
    r"how old are you", r"what do you look like", r"are you pretty",
)

# Checking the child is unsupervised.
_W_ALONE = _phrases(
    r"yolg'izmisan", r"yolgizmisan", r"yoningda kim bor", r"uyda yolg'izmisan",
    r"uyda yolgizmisan", r"ota-onang uydami", r"onang uydami",
    r"telefoningni kim ko'radi", r"telefoningni kim koradi",
    r"ты одна", r"ты один", r"родители дома", r"кто рядом с тобой",
    r"are you alone", r"is anyone with you", r"are your parents home",
    r"who sees your phone",
)

# Moving the conversation somewhere nobody moderates. The literal handles are
# already blocked upstream by `_CONTACT_PATTERNS`; this catches the invitation.
_W_OFF_PLATFORM = _group(
    strict=(
        r"давай в телеграм", r"перейдём в телеграм", r"перейдем в телеграм",
        r"напиши в инстаграм", r"дай свой номер", r"давай в вотсап",
        r"let's talk on telegram", r"lets talk on telegram",
        r"add me on instagram", r"message me on whatsapp",
        r"give me your number",
    ),
    stems=(
        r"telegramda yoz", r"telegramga o't", r"telegramga ot",
        r"boshqa joyda gaplash", r"instagramda yoz", r"whatsappda yoz",
        r"raqamingni ber",
    ),
)

# Adult-style intimacy directed at a child by a peer.
_W_INTIMACY = _group(
    strict=(
        r"я тебя люблю", r"ты только моя", r"ты только мой",
        r"не общайся с другими", r"ты моя девушка", r"ты мой парень",
        r"i love you", r"you're mine", r"youre mine", r"you are mine",
        r"don't talk to anyone else", r"dont talk to anyone else",
        r"be my girlfriend", r"be my boyfriend",
    ),
    stems=(
        r"seni sevaman", r"sen mening qizim", r"sen mening yigitim",
        r"faqat menikisan", r"boshqa hech kim bilan gaplashm",
    ),
)

_WEAK_GROUPS: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("secrecy", _W_SECRECY),
    ("photo", _W_PHOTO),
    ("age_looks", _W_AGE_LOOKS),
    ("alone", _W_ALONE),
    ("off_platform", _W_OFF_PLATFORM),
    ("intimacy", _W_INTIMACY),
)

# How many distinct weak groups make a pattern. Two, not three: grooming that
# has reached three simultaneous signals in ONE message is already far along,
# and the common opener is exactly two ("you're pretty, don't tell your mum").
_WEAK_THRESHOLD = 2

# Arranging to meet offline. Blocked as policy for anyone met through DUYO,
# regardless of intent — the platform cannot vouch for who is on the other end,
# and a rule stated flatly is fairer to children than a judgement about them.
_MEETING = _group(
    strict=(
        r"давай встретимся", r"встретимся", r"встретиться",
        r"где ты живёшь", r"где ты живешь", r"скажи свой адрес",
        r"приду к тебе", r"приеду к тебе",
        r"let's meet", r"lets meet", r"meet up", r"where do you live",
        r"what's your address", r"whats your address", r"i'll come to your",
    ),
    stems=(
        # Personal endings kept so the suffix allowance cannot reach
        # `uchrashuv` — a class meeting is not a safety event.
        r"uchrashamiz", r"uchrashaylik", r"uchrashsak", r"uchrashaman",
        r"ko'rishamiz", r"korishamiz", r"ko'rishaylik", r"korishaylik",
        r"qayerda turasan", r"qayerda yashaysan", r"manzilingni ayt",
        r"oldingga boraman", r"maktabingga boraman",
        r"kel uyimga", r"uyingga boray",
    ),
)


@dataclass(frozen=True)
class PeerHarmResult:
    """Immutable so it can be logged and stored without copying."""

    category: PeerHarmCategory | None = None
    severity: PeerHarmSeverity | None = None
    # Which signal groups fired — this is what an admin reads in the queue to
    # judge the message without the message needing to be re-shown in full.
    signals: tuple[str, ...] = ()

    @property
    def blocked(self) -> bool:
        return self.category is not None

    @property
    def reason(self) -> str | None:
        """Stable string for `PeerMessage.moderation_reason`."""
        return f"peer_harm_{self.category.value}" if self.category else None


def check_peer_harm(text: str) -> PeerHarmResult:
    """Screen one child-to-child message. Never raises.

    Returns the single most severe finding rather than all of them: this
    decides one thing (send or don't), and the signal list carries the detail
    a reviewer needs.
    """
    try:
        if not text or not text.strip():
            return PeerHarmResult()

        normalized = _normalize(text)
        found: list[tuple[PeerHarmCategory, tuple[str, ...]]] = []

        if _SEXUAL.search(normalized):
            found.append((PeerHarmCategory.SEXUAL, ("sexual_explicit",)))
        if _THREAT.search(normalized):
            found.append((PeerHarmCategory.THREAT, ("threat",)))
        if _DEGRADATION.search(normalized):
            found.append((PeerHarmCategory.DEGRADATION, ("degradation",)))

        weak = tuple(
            name for name, pattern in _WEAK_GROUPS if pattern.search(normalized)
        )
        if len(weak) >= _WEAK_THRESHOLD:
            found.append((PeerHarmCategory.GROOMING, weak))

        if _MEETING.search(normalized):
            # A meeting request beside any grooming signal is not a policy
            # slip — it is the last step of the pattern, so it reports as
            # grooming and reaches a reviewer at that severity.
            if weak:
                found.append((PeerHarmCategory.GROOMING, (*weak, "meeting")))
            else:
                found.append((PeerHarmCategory.MEETING, ("meeting",)))

        if not found:
            return PeerHarmResult()

        category, signals = max(
            found, key=lambda pair: _SEVERITY_RANK[SEVERITY[pair[0]]]
        )
        return PeerHarmResult(
            category=category, severity=SEVERITY[category], signals=signals
        )
    except Exception:  # pragma: no cover — defensive; see module docstring
        # Fail CLOSED for a safety filter: if we cannot judge the message, do
        # not deliver it. The opposite default would let malformed input
        # through precisely when something unusual is happening.
        return PeerHarmResult(
            category=PeerHarmCategory.GROOMING,
            severity=PeerHarmSeverity.CRITICAL,
            signals=("detector_error",),
        )
