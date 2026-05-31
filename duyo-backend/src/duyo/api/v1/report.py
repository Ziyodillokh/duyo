"""Parent report endpoint (Concept §11) — 10-day analysis, on-demand + cached.

GET /v1/reports/{child_id}
  Returns the latest cached report if it is younger than CACHE_TTL; otherwise
  generates a fresh one, caches it, and returns that. ?refresh=true forces
  regeneration.

Parent-scoped (another family's child → 404). Privacy §11.3: only aggregates
are returned — never conversation text.
"""

from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from duyo.analysis.reports import build_report
from duyo.api.deps import get_current_user, get_db
from duyo.models.child import ChildProfile
from duyo.models.report import Report
from duyo.models.user import User
from duyo.schemas.report import ReportRead

router = APIRouter(prefix="/reports", tags=["reports"])

# A cached report is reused if younger than this (Concept §11.2 — 10-day cadence;
# 1-day cache keeps it fresh without regenerating on every parent open).
CACHE_TTL = timedelta(days=1)


async def _owned_child(child_id: UUID, user: User, db: AsyncSession) -> ChildProfile:
    child = await db.scalar(
        select(ChildProfile).where(
            ChildProfile.id == child_id,
            ChildProfile.parent_id == user.id,
        )
    )
    if child is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Child not found")
    return child


def _to_read(report: Report, *, cached: bool) -> ReportRead:
    return ReportRead(
        child_id=report.child_id,
        period_start=report.period_start,
        period_end=report.period_end,
        llm_ok=report.llm_ok,
        cached=cached,
        sections=report.sections,
    )


@router.get("/{child_id}", response_model=ReportRead)
async def get_report(
    child_id: UUID,
    refresh: bool = Query(default=False, description="Force regeneration"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ReportRead:
    child = await _owned_child(child_id, current_user, db)
    now = datetime.now(UTC)

    if not refresh:
        latest = await db.scalar(
            select(Report)
            .where(Report.child_id == child_id)
            .order_by(Report.created_at.desc())
            .limit(1)
        )
        if latest is not None:
            created = latest.created_at
            if created.tzinfo is None:
                created = created.replace(tzinfo=UTC)
            if now - created < CACHE_TTL:
                return _to_read(latest, cached=True)

    data = await build_report(db, child_id, now=now, age=child.age)
    report = Report(
        child_id=child_id,
        period_start=data.period_start,
        period_end=data.period_end,
        sections=data.sections,
        llm_ok=data.llm_ok,
    )
    db.add(report)
    await db.flush()
    return _to_read(report, cached=False)
