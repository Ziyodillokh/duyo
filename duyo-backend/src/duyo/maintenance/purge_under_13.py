"""Erase the child profiles below the 13+ age floor.

DUYO is published as a 13+ app. Migration 0042_child_age_floor_13 puts that
in the schema as a CHECK constraint and REFUSES to run while rows violate it,
because the rows are children with conversations, notes, goals and a crisis
history behind them — what happens to those is an owner's decision and a data
protection question, not something a schema change decides at 3am.

This is that decision, carried out. Run it once, then deploy.

It is not a DELETE statement, and the difference matters:

  * A whole account whose every child is under 13 has no reason to exist on a
    13+ app, so it goes entirely — through the same `delete_account` the
    DELETE /v1/me route uses, which also clears the OTP state Redis holds
    against that phone number. Left behind, the next person to be issued that
    number inherits it.

  * An account that ALSO holds a child who is old enough keeps standing, and
    only the under-age profile is erased. Deleting the family over the second
    child would take the first one's data with it.

  * Either way the photo and any voice or video note leave the bucket. A row
    can be deleted in a transaction; an object in MinIO cannot, so the keys
    are read before the delete and the objects removed after it.

Usage — reports and changes nothing:

    docker exec duyo-api python -m duyo.maintenance.purge_under_13

Then, to carry it out:

    docker exec duyo-api python -m duyo.maintenance.purge_under_13 --apply

Or use the "Purge under-13 profiles" workflow in GitHub Actions, which runs
exactly this over the deploy's own SSH key.

It must run inside the RUNNING api container, not a one-off `docker run`: the
deploy's env-file carries the database URL but not the Redis and MinIO
settings, and a run without those would erase the rows and silently skip both
the OTP purge and the bucket. It lives in the package rather than in
duyo-backend/scripts/ because that directory is neither rsynced to the server
nor copied into the image — a maintenance task kept there is one that cannot
be run where the data is.
"""

from __future__ import annotations

import argparse
import asyncio
from collections import defaultdict
from uuid import UUID

from sqlalchemy import func, select

from duyo.core.database import get_session_factory
from duyo.models.child import ChildProfile
from duyo.models.user import User
from duyo.services.account_deletion import delete_account, delete_children

AGE_FLOOR = 13


async def _survey(db) -> tuple[dict[UUID, list[ChildProfile]], dict[UUID, int]]:
    """The under-age profiles grouped by account, and each account's total.

    The total is what decides whether the account itself goes: an account is
    only erased when it holds nothing else.
    """
    under = (
        await db.scalars(
            select(ChildProfile)
            .where(ChildProfile.age < AGE_FLOOR)
            .order_by(ChildProfile.created_at)
        )
    ).all()

    by_account: dict[UUID, list[ChildProfile]] = defaultdict(list)
    for child in under:
        by_account[child.parent_id].append(child)

    totals: dict[UUID, int] = dict(
        (
            await db.execute(
                select(ChildProfile.parent_id, func.count(ChildProfile.id))
                .where(ChildProfile.parent_id.in_(by_account.keys()))
                .group_by(ChildProfile.parent_id)
            )
        ).all()
    )
    return by_account, totals


async def main(apply: bool) -> int:
    session_factory = get_session_factory()

    async with session_factory() as db:
        by_account, totals = await _survey(db)

        if not by_account:
            print(f"Yoshi {AGE_FLOOR} dan kichik profil yo'q — migratsiya o'tadi.")
            return 0

        children_total = sum(len(v) for v in by_account.values())
        whole_accounts = [a for a in by_account if totals[a] == len(by_account[a])]
        mixed = [a for a in by_account if a not in whole_accounts]

        print(f"{children_total} ta profil, {len(by_account)} ta hisobda:\n")
        for account_id, kids in by_account.items():
            fate = (
                "HISOB butunlay o'chadi"
                if account_id in whole_accounts
                else f"faqat profil o'chadi (hisobda yana {totals[account_id] - len(kids)} ta bola bor)"
            )
            print(f"  hisob {account_id} — {fate}")
            for c in kids:
                print(f"      {c.age} yosh  {c.name!r}  yaratilgan {c.created_at:%Y-%m-%d}")
        print()

        if not apply:
            print("Bu QURUQ ishga tushirish — hech narsa o'chirilmadi.")
            print("Bajarish uchun --apply bilan qayta ishga tushiring.")
            return 0

        erased_children = erased_media = retained_crisis = 0

        for account_id in whole_accounts:
            user = await db.get(User, account_id)
            if user is None:
                # The profiles point at an account that is already gone; the
                # child rows are orphans and the mixed path handles them.
                mixed.append(account_id)
                continue
            receipt = await delete_account(db, user)
            erased_children += receipt.children
            erased_media += receipt.media_objects
            retained_crisis += receipt.crisis_events_retained
            print(f"  hisob {account_id} o'chirildi ({receipt.children} profil)")

        for account_id in mixed:
            ids = [c.id for c in by_account[account_id]]
            receipt = await delete_children(db, ids)
            erased_children += receipt.children
            erased_media += receipt.media_objects
            retained_crisis += receipt.crisis_events_retained
            print(f"  hisob {account_id} — {receipt.children} profil o'chirildi, hisob qoldi")

        print(
            f"\nBajarildi: {erased_children} profil, {erased_media} media obyekt o'chdi; "
            f"{retained_crisis} inqiroz yozuvi shaxssizlantirilib saqlandi."
        )

        remaining = len(
            (await db.scalars(select(ChildProfile.id).where(ChildProfile.age < AGE_FLOOR))).all()
        )
        if remaining:
            print(f"OGOHLANTIRISH: hali {remaining} ta qoldi — migratsiya yana to'xtaydi.")
            return 1
        print("Endi 0042_child_age_floor_13 o'tadi.")
        return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Haqiqatan o'chirish. Busiz faqat hisobot chiqadi.",
    )
    raise SystemExit(asyncio.run(main(parser.parse_args().apply)))
