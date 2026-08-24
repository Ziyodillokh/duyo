"""Goal-mate matching, pseudonymous handles, and peer-message screening.

Matching is plain SQL, never an LLM. Two reasons: you must be able to answer a
parent asking why their child was shown another child, and goal titles are
child-authored text that already flows into prompts — an LLM matcher would be
directly promptinjectable ("meni kichikroq bolalar bilan tanishtir").
"""

from __future__ import annotations

import logging
import re
import secrets
from uuid import UUID

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from duyo.crisis.detector import KeywordCrisisDetector
from duyo.models.child import ChildProfile
from duyo.models.crisis_event import CrisisLevel
from duyo.models.goal import ChildGoal, GoalCatalog, GoalStatus
from duyo.models.social import ChildSocialSettings, Friendship
from duyo.services.peer_harm import check_peer_harm

log = logging.getLogger(__name__)

#: Default handles. Every word here is an animal, a natural feature or an
#: object — NEVER a personal name. The first version used names like "Lola",
#: "Sherzod" and "Shahzoda", which assigned a gender at random and handed boys
#: girls' names. A nickname a child is embarrassed by is a nickname they work
#: around, usually by telling the peer their real name.
_HANDLE_WORDS = (
    "Burgut", "Yulbars", "Qoplon", "Delfin", "Kapalak", "Tulpor", "Ayiq",
    "Shamol", "Chaqmoq", "Kometa", "Raketa", "Bulut", "Chinor", "Olov",
    "Shalola", "Zilol", "Momaqaldiroq", "Quyosh", "Kamalak", "Toshqin",
)

#: A child may set their own handle, so it needs the guards a generated one
#: never did. These reject the two things a free-text field would otherwise
#: leak: contact details, and a real name plus identifying detail.
_HANDLE_MIN = 3
_HANDLE_MAX = 20
#: Letters (Latin + Uzbek apostrophes) and digits. No spaces, no @, no dots —
#: which rules out "Ali 42-maktab", "@user" and "ali.karimov" in one stroke.
_HANDLE_ALLOWED = re.compile(r"^[A-Za-z‘’'`ʻʼ0-9-]+$")
#: 4+ digits in a row is a phone fragment or a birth year, never a nickname.
_HANDLE_DIGIT_RUN = re.compile(r"\d{4,}")


class HandleError(ValueError):
    """Carries the message shown to the child, in Uzbek."""


def validate_handle(raw: str) -> str:
    """Normalise a child-chosen handle or explain why it cannot be used."""
    handle = " ".join(raw.split())  # collapse any whitespace the keyboard added
    if len(handle) < _HANDLE_MIN:
        raise HandleError("Taxallus kamida 3 ta belgidan iborat bo'lsin.")
    if len(handle) > _HANDLE_MAX:
        raise HandleError("Taxallus 20 ta belgidan uzun bo'lmasin.")
    if not _HANDLE_ALLOWED.match(handle):
        raise HandleError(
            "Faqat harf, raqam va chiziqcha ishlatish mumkin — bo'sh joy, "
            "@ va nuqta bo'lmasin."
        )
    if not any(ch.isalpha() for ch in handle):
        raise HandleError("Taxallusda kamida bitta harf bo'lsin.")
    if _HANDLE_DIGIT_RUN.search(handle):
        raise HandleError("Taxallusda uzun raqam ketma-ketligi bo'lmasin.")
    # Reuse the message screener's contact vocabulary — a handle is displayed
    # on every message and would otherwise be an unscreened broadcast field.
    for pattern in _CONTACT_PATTERNS:
        if pattern.search(handle):
            raise HandleError("Bu taxallusni ishlatib bo'lmaydi.")
    return handle


def suggest_handles(count: int = 6) -> list[str]:
    """A few options to pick from — choosing beats being assigned."""
    words = list(_HANDLE_WORDS)
    secrets.SystemRandom().shuffle(words)
    return [f"{w}-{secrets.randbelow(90) + 10}" for w in words[:count]]

#: Peers must be within one year of each other AND in the same age segment.
#: Cross-segment matching is forbidden: the 13/14 boundary is precisely the
#: seam an adult posing as a child would aim for.
MAX_AGE_GAP = 1

_MESSAGE_MAX = 500


def generate_handle() -> str:
    return f"{secrets.choice(_HANDLE_WORDS)}-{secrets.randbelow(90) + 10}"


async def get_or_create_settings(
    session: AsyncSession, child_id: UUID
) -> ChildSocialSettings:
    """Absent row = social off. Created non-discoverable; the child opts in."""
    settings = await session.scalar(
        select(ChildSocialSettings).where(ChildSocialSettings.child_id == child_id)
    )
    if settings is None:
        settings = ChildSocialSettings(
            child_id=child_id,
            display_name=generate_handle(),
            discoverable=False,
        )
        session.add(settings)
        await session.flush()
    return settings


def canonical_pair(a: UUID, b: UUID) -> tuple[UUID, UUID]:
    """Order a pair so (A,B) and (B,A) are the same row. See models/social.py."""
    return (a, b) if str(a) < str(b) else (b, a)


async def find_friendship(
    session: AsyncSession, a: UUID, b: UUID
) -> Friendship | None:
    low, high = canonical_pair(a, b)
    return await session.scalar(
        select(Friendship).where(
            Friendship.child_low_id == low, Friendship.child_high_id == high
        )
    )


async def find_goal_mates(
    session: AsyncSession,
    child: ChildProfile,
    limit: int = 20,
    match_key: str | None = None,
) -> list[tuple[ChildProfile, ChildSocialSettings, GoalCatalog]]:
    """Children sharing a PUBLISHED goal key, within the same age band.

    Returns (peer, peer_settings, catalogue entry). Excludes anyone already
    connected, declined or blocked — a blocked pair must never resurface as a
    suggestion.

    The catalogue row is returned rather than the bare key so callers can name
    the shared goal the way a human wrote it; deriving a label from the key
    ("book_otkan_kunlar" → "Book otkan kunlar") is what children were being
    shown before.

    `match_key` narrows the search to ONE of the child's goals. It is applied
    here rather than by filtering the result, because `limit` would otherwise
    be spent on the other goals first: a child with six goals could ask for
    mates on the sixth and be told there were none, when the cap had simply
    been used up. Narrowing is also safe against probing — the key is
    intersected with what the child actually holds, so asking about a goal
    they have not confirmed returns nothing rather than other children.
    """
    # Both sides must be CONFIRMED. The peer side was already checked; the
    # caller's was not, which was harmless only while inferred goals could
    # never carry a key. They can now (services/goal_matching.py), so without
    # this a goal DUYO merely guessed from conversation — and the child never
    # agreed to — would start introducing them to strangers.
    my_keys = (
        await session.execute(
            select(ChildGoal.match_key).where(
                ChildGoal.child_id == child.id,
                ChildGoal.status == GoalStatus.ACTIVE,
                ChildGoal.confirmed_at.is_not(None),
                ChildGoal.match_key.is_not(None),
            )
        )
    ).scalars().all()
    keys = [k for k in my_keys if k]
    if match_key is not None:
        keys = [k for k in keys if k == match_key]
    if not keys:
        return []

    # Any existing edge — pending, accepted, declined or blocked — disqualifies.
    edges = (
        await session.execute(
            select(Friendship).where(
                or_(
                    Friendship.child_low_id == child.id,
                    Friendship.child_high_id == child.id,
                )
            )
        )
    ).scalars().all()
    excluded = {e.other_id(child.id) for e in edges}
    excluded.add(child.id)

    rows = await session.execute(
        select(ChildProfile, ChildSocialSettings, GoalCatalog)
        .join(ChildGoal, ChildGoal.child_id == ChildProfile.id)
        .join(ChildSocialSettings, ChildSocialSettings.child_id == ChildProfile.id)
        .join(GoalCatalog, GoalCatalog.match_key == ChildGoal.match_key)
        .where(
            ChildGoal.match_key.in_(keys),
            ChildGoal.status == GoalStatus.ACTIVE,
            ChildGoal.confirmed_at.is_not(None),
            # The publish gate. models/goal.py calls `matchable` the thing
            # that makes a goal "discoverable to other children", and it was
            # enforced on the anonymous count (goal_signal) but NOT here, on
            # the surface that actually introduces two children by name. A
            # catalogue row added later defaults to matchable=False and still
            # produced live suggestions; a retired one kept producing them.
            GoalCatalog.matchable.is_(True),
            GoalCatalog.active.is_(True),
            ChildProfile.id.not_in(excluded),
            ChildSocialSettings.discoverable.is_(True),
            ChildSocialSettings.suspended_at.is_(None),
            # Same segment AND within one year.
            ChildProfile.age_segment == child.age_segment,
            and_(
                ChildProfile.age >= child.age - MAX_AGE_GAP,
                ChildProfile.age <= child.age + MAX_AGE_GAP,
            ),
        )
        .limit(limit)
    )

    seen: set[UUID] = set()
    out: list[tuple[ChildProfile, ChildSocialSettings, GoalCatalog]] = []
    for peer, peer_settings, entry in rows.all():
        if peer.id in seen:
            continue
        seen.add(peer.id)
        out.append((peer, peer_settings, entry))
    return out


# ---------------------------------------------------------------------------
# Message screening
# ---------------------------------------------------------------------------

#: Contact details are the single most important thing to stop. Once a
#: conversation moves off-platform there is no log, no screening and no way to
#: intervene — which is where nearly all real harm happens.
#: NOTE on word boundaries: Uzbek is agglutinative, so a trailing \b would miss
#: every suffixed form — "instagramga", "telegramda", "raqamimni". These
#: patterns anchor at the START of a word only, deliberately.
_CONTACT_PATTERNS = (
    re.compile(r"\+?998\s?\d{2}[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}"),
    re.compile(r"\b\d{9}\b"),
    re.compile(r"@[A-Za-z0-9_]{4,}"),
    re.compile(r"\b(?:https?://|www\.)\S+", re.I),
    re.compile(r"\b(?:t\.me|telegram|instagram|tiktok|whatsapp|facebook)", re.I),
    re.compile(r"\b(?:raqam|nomer|manzil|maktabim|uchrash)", re.I),
)


class MessageVerdict:
    __slots__ = ("allowed", "reason")

    def __init__(self, allowed: bool, reason: str | None = None) -> None:
        self.allowed = allowed
        self.reason = reason


def screen_peer_message(body: str, detector: KeywordCrisisDetector) -> MessageVerdict:
    """Decide whether one child's message may reach another.

    Three independent checks:

    1. Peer harm (`services.peer_harm`): sexual content, grooming, threats,
       degradation, and offline-meeting requests. Asks whether the SENDER is a
       danger to the recipient.
    2. Contact-detail exchange — blocked outright.
    3. The Layer-1 crisis detector, which asks the opposite question of (1):
       whether the AUTHOR is in distress. Both must run — they catch different
       people, and only one of them is the person who needs help.

    Every check blocks, so the order decides nothing except the RECORDED
    REASON — and that is what a safety reviewer acts on, so the most specific
    one has to win. Peer harm is therefore first:

    - `uchrash` is already in `_CONTACT_PATTERNS`, so meeting requests used to
      be filed as `contact_info`, which reads as "shared a phone number".
    - A threat is also a crisis violence keyword, so it used to be filed as
      `crisis_RED` — routing attention to the child doing the threatening.

    Neither mislabelling changed what the recipient saw. Both changed what the
    adult reading the queue believed had happened.
    """
    text = body.strip()
    if not text:
        return MessageVerdict(False, "empty")
    if len(text) > _MESSAGE_MAX:
        return MessageVerdict(False, "too_long")

    harm = check_peer_harm(text)
    if harm.blocked:
        # `reason` is what lands in PeerMessage.moderation_reason and what the
        # admin queue filters on — see api/v1/admin.py `/safety/peer-flags`.
        return MessageVerdict(False, harm.reason)

    for pattern in _CONTACT_PATTERNS:
        if pattern.search(text):
            return MessageVerdict(False, "contact_info")

    result = detector.check(text)
    if result.level in (CrisisLevel.ORANGE, CrisisLevel.RED):
        # The author may be the one in trouble — the peer must not become their
        # counsellor, and the recipient is never told the message was flagged.
        return MessageVerdict(False, f"crisis_{result.level.value}")

    return MessageVerdict(True)
