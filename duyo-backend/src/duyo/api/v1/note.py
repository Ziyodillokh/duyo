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
from typing import Literal
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
    BacklinkItem,
    GraphEdgeRead,
    GraphNodeRead,
    GraphRead,
    LinkMentionRequest,
    NoteCreate,
    NoteListItem,
    NoteRead,
    NoteSearchHit,
    NoteUpdate,
    TagRename,
    UnlinkedMention,
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


_EXCERPT_RADIUS = 45


def _excerpt(body: str, needle: str) -> str:
    """The words around the first match, so a hit shows why it matched."""
    at = (body or "").lower().find(needle.lower())
    if at < 0:
        return (body or "")[: _EXCERPT_RADIUS * 2].strip()
    start = max(0, at - _EXCERPT_RADIUS)
    end = min(len(body), at + len(needle) + _EXCERPT_RADIUS)
    text = body[start:end].replace("\n", " ").strip()
    return f"{'…' if start else ''}{text}{'…' if end < len(body) else ''}"


async def _read(db: AsyncSession, note: ChildNote) -> NoteRead:
    """NoteRead with tags parsed from the body it carries.

    Refreshes first: `updated_at` is `onupdate=func.now()`, so after an UPDATE
    the value lives in the database and the attribute is expired. Reading it
    without an explicit await triggers a lazy load outside the greenlet and
    raises MissingGreenlet — a 500 on every note edit.
    """
    await db.refresh(note)
    return NoteRead(
        id=note.id,
        title=note.title,
        body=note.body,
        created_at=note.created_at,
        updated_at=note.updated_at,
        tags=notes_service.extract_tags(note.body),
    )


@router.post("", response_model=NoteRead, status_code=status.HTTP_201_CREATED)
async def create_note(
    payload: NoteCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    detector: KeywordCrisisDetector = Depends(get_detector),
) -> NoteRead:
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
    return await _read(db, note)


@router.get("", response_model=list[NoteListItem])
async def list_notes(
    child_id: UUID,
    tag: str | None = None,
    sort: Literal["updated", "created", "title"] = "updated",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ChildNote]:
    """Every note — optionally only those carrying a #tag.

    Tag filtering happens in Python for the same reason tags aren't a column:
    they're parsed from the body on read, so they can never drift out of step
    with the text the child actually sees.
    """
    child = await _owned_child(child_id, current_user, db)
    order = {
        "updated": ChildNote.updated_at.desc(),
        "created": ChildNote.created_at.desc(),
        "title": ChildNote.title.asc(),
    }[sort]
    rows = await db.scalars(
        select(ChildNote).where(ChildNote.child_id == child.id).order_by(order)
    )
    notes = list(rows.all())
    if tag:
        wanted = tag.lstrip("#").lower()
        notes = [n for n in notes if wanted in notes_service.extract_tags(n.body)]
    return notes


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
                          links=n.links, exists=n.exists, kind=n.kind)
            for n in nodes
        ],
        edges=[
            GraphEdgeRead(source=e.source, target=e.target, kind=e.kind)
            for e in edges
        ],
    )


@router.get("/search", response_model=list[NoteSearchHit])
async def search_notes(
    child_id: UUID,
    q: str,
    tag: str | None = None,
    limit: int = 30,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[NoteSearchHit]:
    """Substring search over title and body, optionally narrowed to a #tag.

    ILIKE rather than a tsvector index: a child's notebook is tens of notes,
    not a corpus, and Postgres full-text stemming has no Uzbek dictionary — it
    would match worse than a plain substring while costing an index to
    maintain. Revisit if a child ever reaches thousands of notes.
    """
    child = await _owned_child(child_id, current_user, db)
    needle = q.strip()
    if not needle:
        return []

    pattern = f"%{needle}%"
    rows = (
        await db.scalars(
            select(ChildNote)
            .where(
                ChildNote.child_id == child.id,
                ChildNote.title.ilike(pattern) | ChildNote.body.ilike(pattern),
            )
            .order_by(ChildNote.updated_at.desc())
            .limit(min(limit, 100))
        )
    ).all()

    hits: list[NoteSearchHit] = []
    for note in rows:
        if tag and tag.lower() not in notes_service.extract_tags(note.body):
            continue
        hits.append(NoteSearchHit(
            id=note.id,
            title=note.title,
            updated_at=note.updated_at,
            excerpt=_excerpt(note.body, needle),
        ))
    return hits


@router.get("/tags", response_model=list[str])
async def list_tags(
    child_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[str]:
    """Every #tag the child has used, most-used first."""
    child = await _owned_child(child_id, current_user, db)
    bodies = (
        await db.scalars(
            select(ChildNote.body).where(ChildNote.child_id == child.id)
        )
    ).all()
    counts: dict[str, int] = {}
    for body in bodies:
        for tag in notes_service.extract_tags(body):
            counts[tag] = counts.get(tag, 0) + 1
    return [t for t, _ in sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))]


@router.get("/{note_id}/backlinks", response_model=list[BacklinkItem])
async def backlinks(
    note_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[BacklinkItem]:
    """Notes that link here — "who mentions this?".

    Resolved from the bodies rather than a link table: at a child's scale the
    scan is trivial, and a table would need to stay in step with every edit.
    """
    note = await _owned_note(note_id, current_user, db)
    rows = (
        await db.execute(
            select(ChildNote.id, ChildNote.title, ChildNote.body)
            .where(ChildNote.child_id == note.child_id, ChildNote.id != note.id)
        )
    ).all()
    target = note.title.casefold()
    return [
        BacklinkItem(id=rid, title=rtitle)
        for rid, rtitle, body in rows
        if any(link.casefold() == target for link in notes_service.extract_links(body))
    ]


@router.get("/{note_id}/unlinked-mentions", response_model=list[UnlinkedMention])
async def unlinked_mentions(
    note_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[UnlinkedMention]:
    """Notes that name this one in prose but never [[linked]] it.

    Obsidian's "unlinked mentions" pane. The child gets a button that does the
    linking, which is the only realistic way a nine-year-old builds a graph.
    """
    note = await _owned_note(note_id, current_user, db)
    rows = (
        await db.execute(
            select(ChildNote.id, ChildNote.title, ChildNote.body)
            .where(ChildNote.child_id == note.child_id, ChildNote.id != note.id)
        )
    ).all()
    return [
        UnlinkedMention(id=rid, title=rtitle, excerpt=_excerpt(body, note.title))
        for rid, rtitle, body in rows
        if notes_service.mentions_without_link(body, note.title)
    ]


@router.post("/{note_id}/link-mention", response_model=NoteRead)
async def link_mention(
    note_id: UUID,
    payload: LinkMentionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> NoteRead:
    """Wrap `source`'s first prose mention of this note in [[…]].

    Returns the SOURCE note, since that's the one whose text changed.
    """
    target = await _owned_note(note_id, current_user, db)
    source = await _owned_note(payload.source_id, current_user, db)
    if source.child_id != target.child_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Note not found")
    source.body = notes_service.link_mention(source.body, target.title)
    await db.flush()
    return await _read(db, source)


@router.put("/tags/rename", response_model=int)
async def rename_tag(
    payload: TagRename,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> int:
    """Rename a #tag across every note. Returns how many notes changed.

    Vault-wide, as in Obsidian: a tag that means one thing must be one node,
    and a child who typed #kosmoss once shouldn't be stuck with it.
    """
    child = await _owned_child(payload.child_id, current_user, db)
    rows = (
        await db.scalars(select(ChildNote).where(ChildNote.child_id == child.id))
    ).all()
    changed = 0
    for note in rows:
        updated = notes_service.rename_tag(note.body, payload.old, payload.new)
        if updated != note.body:
            note.body = updated
            changed += 1
    await db.flush()
    return changed


@router.get("/{note_id}", response_model=NoteRead)
async def get_note(
    note_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> NoteRead:
    return await _read(db, await _owned_note(note_id, current_user, db))


@router.put("/{note_id}", response_model=NoteRead)
async def update_note(
    note_id: UUID,
    payload: NoteUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    detector: KeywordCrisisDetector = Depends(get_detector),
) -> NoteRead:
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
    return await _read(db, note)


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_note(
    note_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    note = await _owned_note(note_id, current_user, db)
    await db.delete(note)
    await db.flush()
