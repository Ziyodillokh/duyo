"""Goal groups — the rooms behind the Maqsaddoshlar circles.

A group is a CATEGORY of the published goal catalogue, narrowed to one age
segment: "kitoblar:explorer" is every 11-13-year-old who is reading. There is
no membership table and no join button, and that is the safety design, not a
shortcut:

* Being in a room is the same fact as holding a confirmed, matchable goal in
  that category while discoverable. A child who retires the goal, or turns
  visibility off, is out of the room the same instant — one switch, not two
  that can drift apart.
* Segments never mix. Sharing a goal is not a reason to put a nine-year-old
  and a fifteen-year-old in the same conversation, so the segment is part of
  the room's identity rather than a filter over one big room.
* Every message still goes through `screen_peer_message`, exactly as a
  one-to-one message does. A room is a bigger audience, never a lighter one.

Categories are matched from `match_key` by rule rather than stored on the
catalogue row, so the client and the server agree without a migration every
time a goal is added. The rules live here, once.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from duyo.models.child import AgeSegment, ChildProfile
from duyo.models.goal import ChildGoal, GoalCatalog, GoalStatus
from duyo.models.social import ChildSocialSettings


@dataclass(frozen=True)
class Category:
    key: str
    label: str
    matches: Callable[[str], bool]


#: Order is precedence: the first rule that matches a key owns it, so a
#: textbook_ingliz_5 lands in "til" rather than "talim".
CATEGORIES: tuple[Category, ...] = (
    Category("it", "IT & Code", lambda k: "dasturlash" in k),
    Category("til", "Til o'rganish", lambda k: "ingliz" in k or "ielts" in k),
    Category(
        "talim",
        "Ta'lim",
        lambda k: k.startswith("textbook_") or k.startswith("exam_"),
    ),
    Category(
        "kitoblar",
        "Kitoblar",
        lambda k: k.startswith("book_") or k == "habit_har_kuni_kitob",
    ),
    Category("sport", "Sport", lambda k: "sport" in k),
    Category("sayohat", "Sayohat", lambda k: "sayohat" in k),
    Category(
        "ijod", "Ijodkorlik", lambda k: "chizish" in k or "gitara" in k
    ),
    Category(
        "rivoj",
        "O'zini rivojlantirish",
        lambda k: k.startswith("habit_") or k.startswith("skill_"),
    ),
)

_BY_KEY = {c.key: c for c in CATEGORIES}


def category_of(match_key: str | None) -> Category | None:
    if not match_key:
        return None
    for c in CATEGORIES:
        if c.matches(match_key):
            return c
    return None


def group_key(category: str, segment: AgeSegment) -> str:
    """The room's identity: category plus age band, never one without the other."""
    return f"{category}:{segment.value}"


def parse_group_key(key: str) -> tuple[Category, AgeSegment] | None:
    category, _, segment = key.partition(":")
    cat = _BY_KEY.get(category)
    if cat is None:
        return None
    try:
        return cat, AgeSegment(segment)
    except ValueError:
        return None


async def _matchable_keys(session: AsyncSession) -> list[str]:
    """Catalogue keys a group may be built from.

    `matchable` is the publish gate the catalogue already uses to decide what
    may introduce two children; a room is a stronger introduction than a
    suggestion, so it can never be looser.
    """
    rows = await session.execute(
        select(GoalCatalog.match_key).where(
            GoalCatalog.matchable.is_(True), GoalCatalog.active.is_(True)
        )
    )
    return [k for k in rows.scalars().all() if k]


async def categories_for_child(
    session: AsyncSession, child: ChildProfile
) -> list[Category]:
    """The rooms this child is in — derived, never stored."""
    settings = await session.scalar(
        select(ChildSocialSettings).where(ChildSocialSettings.child_id == child.id)
    )
    if settings is None or not settings.discoverable or settings.suspended_at:
        return []

    allowed = set(await _matchable_keys(session))
    mine = await session.execute(
        select(ChildGoal.match_key).where(
            ChildGoal.child_id == child.id,
            ChildGoal.status == GoalStatus.ACTIVE,
            ChildGoal.confirmed_at.is_not(None),
            ChildGoal.match_key.is_not(None),
        )
    )
    found: list[Category] = []
    for key in mine.scalars().all():
        if not key or key not in allowed:
            continue
        cat = category_of(key)
        if cat and cat not in found:
            found.append(cat)
    return found


async def member_ids(
    session: AsyncSession, category: Category, segment: AgeSegment
) -> list[UUID]:
    """Everyone currently in the room, by the same rule as the caller's own
    membership — so a child never sees a roster they are not part of."""
    allowed = [k for k in await _matchable_keys(session) if category.matches(k)]
    if not allowed:
        return []
    rows = await session.execute(
        select(ChildProfile.id)
        .join(ChildGoal, ChildGoal.child_id == ChildProfile.id)
        .join(
            ChildSocialSettings, ChildSocialSettings.child_id == ChildProfile.id
        )
        .where(
            ChildGoal.match_key.in_(allowed),
            ChildGoal.status == GoalStatus.ACTIVE,
            ChildGoal.confirmed_at.is_not(None),
            ChildProfile.age_segment == segment,
            ChildSocialSettings.discoverable.is_(True),
            ChildSocialSettings.suspended_at.is_(None),
        )
        .distinct()
    )
    return list(rows.scalars().all())


async def member_count(
    session: AsyncSession, category: Category, segment: AgeSegment
) -> int:
    allowed = [k for k in await _matchable_keys(session) if category.matches(k)]
    if not allowed:
        return 0
    return (
        await session.scalar(
            select(func.count(func.distinct(ChildProfile.id)))
            .select_from(ChildProfile)
            .join(ChildGoal, ChildGoal.child_id == ChildProfile.id)
            .join(
                ChildSocialSettings,
                ChildSocialSettings.child_id == ChildProfile.id,
            )
            .where(
                ChildGoal.match_key.in_(allowed),
                ChildGoal.status == GoalStatus.ACTIVE,
                ChildGoal.confirmed_at.is_not(None),
                ChildProfile.age_segment == segment,
                ChildSocialSettings.discoverable.is_(True),
                ChildSocialSettings.suspended_at.is_(None),
            )
        )
    ) or 0


async def is_member(
    session: AsyncSession, child: ChildProfile, key: str
) -> Category | None:
    """The gate every group route runs first. Returns the category on success
    so the caller does not have to parse the key twice."""
    parsed = parse_group_key(key)
    if parsed is None:
        return None
    category, segment = parsed
    if child.age_segment != segment:
        return None
    return category if category in await categories_for_child(session, child) else None
