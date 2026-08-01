"""Child notes — the "miya" screen: notes as nodes, [[links]] as edges.

Notes are the child's own writing, so unlike the parent report there is no
aggregation here: the child reads back exactly what they wrote.

SAFETY: note text runs through Crisis Layer 1 on write. A child who writes
distress into a private note is exactly the signal this product exists to
catch, and a diary that silently swallowed it would be a hole in the promise.
Layer 1 only — it is local, free and deterministic, so writing a note never
waits on a network call. Detection raises a CrisisEvent through the same path
as chat; it never blocks the save or shows the child a different screen.
"""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from duyo.api.deps import get_current_user, get_db
from duyo.crisis.detector import KeywordCrisisDetector
from duyo.crisis.router import get_detector
from duyo.models.child import ChildProfile
from duyo.models.crisis_event import CrisisEvent, CrisisLevel
from duyo.models.note import ChildNote
from duyo.models.user import User
from duyo.schemas.note import (
    GraphEdgeRead,
    GraphNodeRead,
    GraphRead,
    NoteCreate,
    NoteListItem,
    NoteRead,
    NoteUpdate,
)
from duyo.services import notes as notes_service

router = APIRouter(prefix="/notes", tags=["notes"])
log = logging.getLogger(__name__)


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


async def _owned_note(note_id: UUID, user: User, db: AsyncSession) -> ChildNote:
    note = await db.scalar(
        select(ChildNote)
        .join(ChildProfile, ChildNote.child_id == ChildProfile.id)
        .where(ChildNote.id == note_id, ChildProfile.parent_id == user.id)
    )
    if note is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Note not found")
    return note


async def _screen(db: AsyncSession, child: ChildProfile, text: str,
                  detector: KeywordCrisisDetector) -> None:
    """Layer 1 over note text. Records the event; never blocks the write."""
    try:
        result = detector.check(text)
    except Exception:
        log.exception("note_crisis_screen_failed child=%s", child.id)
        return
    if result.level == CrisisLevel.GREEN:
        return
    db.add(CrisisEvent(
        message_id=None,
        child_id=child.id,
        level=result.level,
        layer=1,
        matches=[{
            "keyword": m.keyword,
            "category": m.category.value,
            "language": m.language,
            "source": "note",
        } for m in result.matches],
    ))
    log.warning("CRISIS in note: level=%s child=%s", result.level.value, child.id)


@router.post("", response_model=NoteRead, status_code=status.HTTP_201_CREATED)
async def create_note(
    payload: NoteCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    detector: KeywordCrisisDetector = Depends(get_detector),
) -> ChildNote:
    child = await _owned_child(payload.child_id, current_user, db)
    note = ChildNote(child_id=child.id, title=payload.title.strip(), body=payload.body)
    db.add(note)
    try:
        await db.flush()
    except IntegrityError as exc:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Bunday nomli qayd allaqachon bor"
        ) from exc
    await _screen(db, child, f"{payload.title}\n{payload.body}", detector)
    return note


@router.get("", response_model=list[NoteListItem])
async def list_notes(
    child_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ChildNote]:
    child = await _owned_child(child_id, current_user, db)
    rows = await db.scalars(
        select(ChildNote)
        .where(ChildNote.child_id == child.id)
        .order_by(ChildNote.updated_at.desc())
    )
    return list(rows.all())


@router.get("/graph", response_model=GraphRead)
async def note_graph(
    child_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> GraphRead:
    """Nodes and edges for the brain view — one query, no LLM."""
    child = await _owned_child(child_id, current_user, db)
    rows = (
        await db.execute(
            select(ChildNote.id, ChildNote.title, ChildNote.body)
            .where(ChildNote.child_id == child.id)
        )
    ).all()
    nodes, edges = notes_service.build_graph(
        [(str(i), t, b) for i, t, b in rows]
    )
    return GraphRead(
        nodes=[
            GraphNodeRead(id=UUID(n.id) if n.id else None, title=n.title,
                          links=n.links, exists=n.exists)
            for n in nodes
        ],
        edges=[GraphEdgeRead(source=e.source, target=e.target) for e in edges],
    )


@router.get("/{note_id}", response_model=NoteRead)
async def get_note(
    note_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ChildNote:
    return await _owned_note(note_id, current_user, db)


@router.put("/{note_id}", response_model=NoteRead)
async def update_note(
    note_id: UUID,
    payload: NoteUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    detector: KeywordCrisisDetector = Depends(get_detector),
) -> ChildNote:
    note = await _owned_note(note_id, current_user, db)
    if payload.title is not None:
        note.title = payload.title.strip()
    if payload.body is not None:
        note.body = payload.body
    try:
        await db.flush()
    except IntegrityError as exc:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Bunday nomli qayd allaqachon bor"
        ) from exc

    child = await db.scalar(select(ChildProfile).where(ChildProfile.id == note.child_id))
    if child is not None:
        await _screen(db, child, f"{note.title}\n{note.body}", detector)
    return note


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_note(
    note_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    note = await _owned_note(note_id, current_user, db)
    await db.delete(note)
    await db.flush()
