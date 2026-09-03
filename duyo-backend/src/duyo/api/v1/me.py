"""The signed-in account itself — who is holding this phone.

Onboarding asks "are you a parent or a child?" and for a name. Until this
existed both answers lived in a mobile store and were never sent anywhere, so
the backend knew a phone number and nothing else about the person behind it.
"""

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from duyo.api.deps import get_current_user, get_db
from duyo.models.user import User
from duyo.schemas.me import AccountRead, AccountUpdate
from duyo.services import account_deletion

router = APIRouter(prefix="/me", tags=["me"])


def _to_read(user: User) -> AccountRead:
    return AccountRead(
        id=user.id,
        phone=user.phone,
        role=user.role,
        display_name=user.display_name,
        created_at=user.created_at,
        last_login_at=user.last_login_at,
        children_count=len(user.children),
    )


@router.get("", response_model=AccountRead)
async def read_me(current_user: User = Depends(get_current_user)) -> AccountRead:
    return _to_read(current_user)


@router.patch("", response_model=AccountRead)
async def update_me(
    payload: AccountUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AccountRead:
    """Partial update — only the fields present are touched.

    Onboarding calls this right after login, so it must be safe to call again
    on every re-login without wiping what is already there.
    """
    if payload.role is not None:
        current_user.role = payload.role
    if payload.display_name is not None:
        current_user.display_name = payload.display_name.strip() or None
    await db.commit()
    await db.refresh(current_user)
    return _to_read(current_user)


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
async def delete_me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Erase this account and everything behind it. There is no undo.

    Play has required an in-app deletion path since 31 May 2024 and this is
    it. No confirmation field: the destructive question belongs on the screen
    that asks it, and a second one in the payload only makes the client's job
    harder without making the act more deliberate.

    What goes and what stays — including the safety records that are kept,
    de-identified, for their retention period — is spelled out in
    services/account_deletion.py, which is the text the privacy policy has to
    match.
    """
    await account_deletion.delete_account(db, current_user)
