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
from duyo.models.goal import ChildGoal, GoalStatus
from duyo.models.social import ChildSocialSettings, Friendship

log = logging.getLogger(__name__)

#: Handles are drawn from this list — never free-typed. A free-text handle is
#: both a PII channel ("Ali 42-maktab") and an abuse channel that would bypass
#: message screening entirely.
_HANDLE_WORDS = (
    "Yulduz", "Quyosh", "Shamol", "Daryo", "Tog", "Bulut", "Chinor", "Lola",
    "Burgut", "Ohu", "Shahzoda", "Bahor", "Olov", "Qorqiz", "Sherzod",
    "Kapalak", "Anor", "Nilufar", "Humo", "Zilol",
)

#: Peers must be within one year of each other AND in the same age segment.
#: Cross-segment matching is forbidden: the 13/14 boundary is precisely the
#: seam an adult posing as a child would aim for.
_MAX_AGE_GAP = 1

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
    session: AsyncSession, child: ChildProfile, limit: int = 20
) -> list[tuple[ChildProfile, ChildSocialSettings, str]]:
    """Children sharing an active goal key, within the same age band.

    Returns (peer, peer_settings, match_key). Excludes anyone already connected,
    declined or blocked — a blocked pair must never resurface as a suggestion.
    """
    my_keys = (
        await session.execute(
            select(ChildGoal.match_key).where(
                ChildGoal.child_id == child.id,
                ChildGoal.status == GoalStatus.ACTIVE,
                ChildGoal.match_key.is_not(None),
            )
        )
    ).scalars().all()
    keys = [k for k in my_keys if k]
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
        select(ChildProfile, ChildSocialSettings, ChildGoal.match_key)
        .join(ChildGoal, ChildGoal.child_id == ChildProfile.id)
        .join(ChildSocialSettings, ChildSocialSettings.child_id == ChildProfile.id)
        .where(
            ChildGoal.match_key.in_(keys),
            ChildGoal.status == GoalStatus.ACTIVE,
            ChildGoal.confirmed_at.is_not(None),
            ChildProfile.id.not_in(excluded),
            ChildSocialSettings.discoverable.is_(True),
            ChildSocialSettings.suspended_at.is_(None),
            # Same segment AND within one year.
            ChildProfile.age_segment == child.age_segment,
            and_(
                ChildProfile.age >= child.age - _MAX_AGE_GAP,
                ChildProfile.age <= child.age + _MAX_AGE_GAP,
            ),
        )
        .limit(limit)
    )

    seen: set[UUID] = set()
    out: list[tuple[ChildProfile, ChildSocialSettings, str]] = []
    for peer, peer_settings, match_key in rows.all():
        if peer.id in seen:
            continue
        seen.add(peer.id)
        out.append((peer, peer_settings, match_key))
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

    Two independent checks:

    1. Contact-detail exchange — blocked outright.
    2. The existing Layer-1 crisis detector. NOTE what this does and does not
       do: it detects the AUTHOR's distress (suicidal, self-harm, violence,
       abuse). It has NO category for sexual content, grooming or solicitation,
       so it is a floor, not a complete safety net. A dedicated peer-harm
       detector is required before this ships to children who are not the
       team's own.
    """
    text = body.strip()
    if not text:
        return MessageVerdict(False, "empty")
    if len(text) > _MESSAGE_MAX:
        return MessageVerdict(False, "too_long")

    for pattern in _CONTACT_PATTERNS:
        if pattern.search(text):
            return MessageVerdict(False, "contact_info")

    result = detector.check(text)
    if result.level in (CrisisLevel.ORANGE, CrisisLevel.RED):
        # The author may be the one in trouble — the peer must not become their
        # counsellor, and the recipient is never told the message was flagged.
        return MessageVerdict(False, f"crisis_{result.level.value}")

    return MessageVerdict(True)
