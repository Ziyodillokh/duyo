"""Chat history and projects.

Messages were always persisted; nothing read them back. These routes are the
history a child can browse, resume, rename and organise.

Every route goes through `_get_owned_child` (api/v1/chat.py), the single
ownership guard in this codebase, and then through `_owned_conversation` /
`_owned_project`, which 404 rather than 403 for someone else's row so
existence never leaks — the same rule goals and notes follow.
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from duyo.api.deps import get_current_user, get_db
from duyo.api.v1.chat import _get_owned_child
from duyo.models.conversation import Conversation
from duyo.models.message import Message, MessageRole
from duyo.models.project import Project
from duyo.models.user import User
from duyo.schemas.conversation import (
    ConversationRead,
    ConversationUpdate,
    MessageRead,
    ProjectCreate,
    ProjectRead,
    ProjectUpdate,
)

router = APIRouter(tags=["history"])

#: One screenful and then some. The list pages with `before`.
_PAGE = 30
#: A conversation's messages. Long threads page backwards from the newest.
_MESSAGE_PAGE = 100
#: Second line of a history card.
_PREVIEW_MAX = 90
#: A child does not organise their life into fifty folders, and an unbounded
#: count is an unbounded list query on every screen.
_MAX_PROJECTS = 30


async def _owned_conversation(
    child_id: UUID, conversation_id: UUID, db: AsyncSession
) -> Conversation:
    conv = await db.scalar(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.child_id == child_id,
        )
    )
    if conv is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Suhbat topilmadi")
    return conv


async def _owned_project(child_id: UUID, project_id: UUID, db: AsyncSession) -> Project:
    project = await db.scalar(
        select(Project).where(Project.id == project_id, Project.child_id == child_id)
    )
    if project is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Loyiha topilmadi")
    return project


def _preview(text: str | None) -> str | None:
    if not text:
        return None
    flat = " ".join(text.split())
    return flat[:_PREVIEW_MAX] + "…" if len(flat) > _PREVIEW_MAX else flat


# ---------------------------------------------------------------------------
# Conversations
# ---------------------------------------------------------------------------


@router.get(
    "/children/{child_id}/conversations", response_model=list[ConversationRead]
)
async def list_conversations(
    child_id: UUID,
    project_id: UUID | None = Query(default=None),
    ungrouped: bool = Query(default=False),
    limit: int = Query(default=_PAGE, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ConversationRead]:
    """The history list, most recent activity first.

    Empty conversations are excluded. One is created the moment a child opens
    the chat tab, so listing them would fill the history with blank rows the
    child never actually used.
    """
    child = await _get_owned_child(child_id, current_user, db)

    stmt = select(Conversation).where(
        Conversation.child_id == child.id,
        Conversation.message_count > 0,
    )
    if project_id is not None:
        await _owned_project(child.id, project_id, db)
        stmt = stmt.where(Conversation.project_id == project_id)
    elif ungrouped:
        stmt = stmt.where(Conversation.project_id.is_(None))

    rows = (
        await db.execute(stmt.order_by(Conversation.updated_at.desc()).limit(limit))
    ).scalars().all()
    if not rows:
        return []

    # Two extra queries for the whole page rather than two per row: the first
    # child message names an untitled conversation, the last message of any
    # role is the preview.
    ids = [c.id for c in rows]

    first_child_msg: dict[UUID, str] = {}
    oldest = (
        await db.execute(
            select(Message.conversation_id, Message.content, Message.created_at)
            .where(
                Message.conversation_id.in_(ids),
                Message.role == MessageRole.CHILD,
            )
            .order_by(Message.conversation_id, Message.created_at)
        )
    ).all()
    for conv_id, content, _ in oldest:
        first_child_msg.setdefault(conv_id, content)

    last_msg: dict[UUID, str] = {}
    newest = (
        await db.execute(
            select(Message.conversation_id, Message.content, Message.created_at)
            .where(Message.conversation_id.in_(ids))
            .order_by(Message.conversation_id, Message.created_at.desc())
        )
    ).all()
    for conv_id, content, _ in newest:
        last_msg.setdefault(conv_id, content)

    return [
        ConversationRead(
            id=conv.id,
            # Conversations created before titling exists fall back to their
            # opening message, so the list never shows a blank or a UUID.
            title=conv.title or _preview(first_child_msg.get(conv.id)) or "Suhbat",
            project_id=conv.project_id,
            message_count=conv.message_count,
            preview=_preview(last_msg.get(conv.id)),
            updated_at=conv.updated_at,
            created_at=conv.created_at,
        )
        for conv in rows
    ]


@router.get(
    "/children/{child_id}/conversations/{conversation_id}/messages",
    response_model=list[MessageRead],
)
async def list_conversation_messages(
    child_id: UUID,
    conversation_id: UUID,
    before: UUID | None = Query(default=None, description="Page backwards from this message"),
    limit: int = Query(default=_MESSAGE_PAGE, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[MessageRead]:
    """A conversation's messages, oldest-first, newest page by default.

    Paging from the END is what a chat needs: opening a thread should show
    where it left off, not its first screen from three weeks ago.
    """
    child = await _get_owned_child(child_id, current_user, db)
    conv = await _owned_conversation(child.id, conversation_id, db)

    stmt = select(Message).where(Message.conversation_id == conv.id)
    if before is not None:
        cursor = await db.scalar(
            select(Message.created_at).where(
                Message.id == before, Message.conversation_id == conv.id
            )
        )
        if cursor is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Xabar topilmadi")
        stmt = stmt.where(Message.created_at < cursor)

    rows = (
        await db.execute(stmt.order_by(Message.created_at.desc()).limit(limit))
    ).scalars().all()

    return [
        MessageRead(
            id=m.id,
            role=m.role.value if hasattr(m.role, "value") else str(m.role),
            content=m.content,
            created_at=m.created_at,
        )
        for m in reversed(rows)
    ]


@router.patch(
    "/children/{child_id}/conversations/{conversation_id}",
    response_model=ConversationRead,
)
async def update_conversation(
    child_id: UUID,
    conversation_id: UUID,
    payload: ConversationUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ConversationRead:
    """Rename, file into a project, or take out of one."""
    child = await _get_owned_child(child_id, current_user, db)
    conv = await _owned_conversation(child.id, conversation_id, db)

    if payload.title is not None:
        conv.title = payload.title
    if payload.clear_project:
        conv.project_id = None
    elif payload.project_id is not None:
        # Verified as this child's own — otherwise a conversation could be
        # filed into another family's project.
        await _owned_project(child.id, payload.project_id, db)
        conv.project_id = payload.project_id
    await db.flush()
    # `updated_at` is onupdate=func.now(), so the flush expires it; reading it
    # below would then attempt IO outside the async context and raise
    # MissingGreenlet. This is the same defect that once broke every note
    # edit in production (see tests/api/test_note_api.py) — refreshing here is
    # what keeps a rename from 500ing.
    await db.refresh(conv)

    return ConversationRead(
        id=conv.id,
        title=conv.title or "Suhbat",
        project_id=conv.project_id,
        message_count=conv.message_count,
        preview=None,
        updated_at=conv.updated_at,
        created_at=conv.created_at,
    )


@router.delete(
    "/children/{child_id}/conversations/{conversation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_conversation(
    child_id: UUID,
    conversation_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Erase a conversation and its messages.

    Crisis events reference messages with ON DELETE SET NULL, so the safety
    audit trail survives a child deleting the conversation it came from —
    deliberately: the record of a child at risk is not the child's to erase,
    and it carries no message text of its own.
    """
    child = await _get_owned_child(child_id, current_user, db)
    conv = await _owned_conversation(child.id, conversation_id, db)
    await db.delete(conv)
    await db.flush()


# ---------------------------------------------------------------------------
# Projects
# ---------------------------------------------------------------------------


async def _project_read(db: AsyncSession, project: Project) -> ProjectRead:
    # Refreshed for the same reason as update_conversation: after an INSERT
    # the server-default timestamps are unloaded, and after an UPDATE
    # `updated_at` is expired — reading either lazily raises MissingGreenlet.
    await db.refresh(project)
    count = await db.scalar(
        select(func.count())
        .select_from(Conversation)
        .where(
            Conversation.project_id == project.id,
            Conversation.message_count > 0,
        )
    )
    return ProjectRead(
        id=project.id,
        name=project.name,
        instructions=project.instructions,
        colour=project.colour,
        conversation_count=count or 0,
        created_at=project.created_at,
        updated_at=project.updated_at,
    )


@router.get("/children/{child_id}/projects", response_model=list[ProjectRead])
async def list_projects(
    child_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ProjectRead]:
    child = await _get_owned_child(child_id, current_user, db)
    rows = (
        await db.execute(
            select(Project)
            .where(Project.child_id == child.id)
            .order_by(Project.created_at.desc())
        )
    ).scalars().all()

    if not rows:
        return []
    # One grouped count for the page rather than one query per project.
    counts = dict(
        (
            await db.execute(
                select(Conversation.project_id, func.count())
                .where(
                    Conversation.project_id.in_([p.id for p in rows]),
                    Conversation.message_count > 0,
                )
                .group_by(Conversation.project_id)
            )
        ).all()
    )
    return [
        ProjectRead(
            id=p.id,
            name=p.name,
            instructions=p.instructions,
            colour=p.colour,
            conversation_count=counts.get(p.id, 0),
            created_at=p.created_at,
            updated_at=p.updated_at,
        )
        for p in rows
    ]


@router.post(
    "/children/{child_id}/projects",
    response_model=ProjectRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_project(
    child_id: UUID,
    payload: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProjectRead:
    child = await _get_owned_child(child_id, current_user, db)

    existing = await db.scalar(
        select(func.count()).select_from(Project).where(Project.child_id == child.id)
    )
    if (existing or 0) >= _MAX_PROJECTS:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            f"Loyihalar soni chegarasi ({_MAX_PROJECTS}) to'ldi.",
        )

    project = Project(
        child_id=child.id,
        name=payload.name,
        instructions=payload.instructions,
        colour=payload.colour,
    )
    db.add(project)
    await db.flush()
    return await _project_read(db, project)


@router.patch(
    "/children/{child_id}/projects/{project_id}", response_model=ProjectRead
)
async def update_project(
    child_id: UUID,
    project_id: UUID,
    payload: ProjectUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProjectRead:
    child = await _get_owned_child(child_id, current_user, db)
    project = await _owned_project(child.id, project_id, db)

    if payload.name is not None:
        project.name = payload.name
    if payload.instructions is not None:
        # Empty string clears the instructions; the field being absent leaves
        # them alone.
        project.instructions = payload.instructions or None
    if payload.colour is not None:
        project.colour = payload.colour
    await db.flush()
    return await _project_read(db, project)


@router.delete(
    "/children/{child_id}/projects/{project_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_project(
    child_id: UUID,
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete the folder, keep the conversations.

    The FK is ON DELETE SET NULL, but that only fires at the database; the
    explicit UPDATE keeps the identity map in step so a conversation already
    loaded in this session does not keep a dangling project_id.
    """
    child = await _get_owned_child(child_id, current_user, db)
    project = await _owned_project(child.id, project_id, db)

    await db.execute(
        update(Conversation)
        .where(Conversation.project_id == project.id)
        .values(project_id=None)
        # Without this, a bulk UPDATE leaves any Conversation already loaded
        # in this session holding the deleted project's id, and the very next
        # read in the same request still reports it as filed there.
        .execution_options(synchronize_session="fetch")
    )
    await db.execute(delete(Project).where(Project.id == project.id))
    await db.flush()
